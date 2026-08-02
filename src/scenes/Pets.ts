import { ISpriteConfig } from "../types/ISpriteConfig";
import { useSettingStore } from "../hooks/useSettingStore";
import { listen } from "@tauri-apps/api/event";
import {
    DispatchType,
    EventType,
    TRenderEventListener,
} from "../types/IEvents";
import {
    Direction,
    IWorldBounding,
    ISwitchStateOptions,
    Ease,
} from "../types/IPet";
import { info, error } from "tauri-plugin-log-api";
import defaultSettings from "../../src-tauri/src/app/default/settings.json";
import { ConfigManager, InputManager } from "./manager";

interface Pet extends Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    direction?: Direction;
    availableStates: string[];
    canPlayRandomState: boolean;
    canRandomFlip: boolean;
    id: string;
    timers?: Phaser.Time.TimerEvent[];
    activeTween?: Phaser.Tweens.Tween;
    fallCompleteHandler?: (...args: any[]) => void;
}

export default class Pets extends Phaser.Scene {
    private pets: Pet[] = [];
    private frameCount: number = 0;
    private settingUnlisten?: () => void;
    private settingListenerCancelled: boolean = false;
    // use this array to store index of pet that is currently climb and crawl
    private petClimbAndCrawlIndex: number[] = [];

    private configManager: ConfigManager;
    // input manager to handle mouse, toggle cursor events to ignore cursor events when mouse is over pet
    private inputManager: InputManager;

    // app settings
    private allowPetInteraction: boolean;
    private allowPetAboveTaskbar: boolean;
    private allowOverridePetScale: boolean;
    private petScale: number;
    private allowPetClimbing: boolean;

    private readonly FORBIDDEN_RAND_STATE: string[] = [
        "fall",
        "climb",
        "drag",
        "crawl",
        "drag",
        "bounce",
        "jump",
    ];
    private readonly FRAME_RATE: number = 9;
    private readonly UPDATE_DELAY: number = 1000 / this.FRAME_RATE;
    private readonly PET_MOVE_VELOCITY: number = this.FRAME_RATE * 6;
    private readonly PET_MOVE_ACCELERATION: number = this.PET_MOVE_VELOCITY * 2;
    private readonly TWEEN_ACCELERATION: number = this.FRAME_RATE * 1.1;
    private readonly RAND_STATE_DELAY: number = 3000;
    private readonly FLIP_DELAY: number = 5000;

    constructor() {
        super({ key: "Pets" });

        // Initialize other settings without relying on this.input
        this.allowPetInteraction =
            useSettingStore.getState().allowPetInteraction ??
            defaultSettings.allowPetInteraction;
        this.allowPetAboveTaskbar =
            useSettingStore.getState().allowPetAboveTaskbar ??
            defaultSettings.allowPetAboveTaskbar;
        this.allowOverridePetScale =
            useSettingStore.getState().allowOverridePetScale ??
            defaultSettings.allowOverridePetScale;
        this.petScale =
            useSettingStore.getState().petScale ?? defaultSettings.petScale;
        this.allowPetClimbing =
            useSettingStore.getState().allowPetClimbing ??
            defaultSettings.allowPetClimbing;

        this.configManager = new ConfigManager({
            FRAME_RATE: this.FRAME_RATE,
        });
        this.inputManager = new InputManager();
    }

    preload(): void {
        this.configManager.setConfigManager({
            load: this.load,
            textures: this.textures,
            anims: this.anims,
        });

        this.inputManager.setInputManager({ input: this.input });
        const spriteConfig = this.game.registry.get("spriteConfig");
        this.configManager.setSpriteConfig(spriteConfig);
        this.configManager.loadAllSpriteSheet();
    }

    create(): void {
        this.settingListenerCancelled = false;
        this.inputManager.turnOnIgnoreCursorEvents();
        this.physics.world.setBoundsCollision(true, true, true, true);
        this.scale.on("resize", this.handleScaleResize, this);
        this.updatePetAboveTaskbar();

        // check all loaded sprite (debug only)
        // console.log(this.textures.list);

        let i = 0;
        // create pets
        for (const sprite of this.configManager.getSpriteConfig()) {
            this.addPet(sprite, i);
            i++;
        }

        // register event
        this.input.on(
            "drag",
            (pointer: any, pet: Pet, dragX: number, dragY: number) => {
                this.stopPetTween(pet);
                pet.setPosition(dragX, dragY);

                if (
                    pet.anims &&
                    pet.anims.getName() !==
                        this.configManager.getStateName("drag", pet)
                ) {
                    this.switchState(pet, "drag");
                }

                // disable world bounds when dragging so that pet can go beyond screen
                // @ts-ignore
                if (pet.body!.enable) pet.body!.enable = false;

                // Keep each pet's facing direction independent from other pets.
                if (pet.x > pet.input!.dragStartX) {
                    this.setPetLookToTheLeft(pet, false);
                } else if (pet.x < pet.input!.dragStartX) {
                    this.setPetLookToTheLeft(pet, true);
                }
            }
        );

        this.input.on("dragend", (pointer: any, pet: Pet) => {
            this.stopPetTween(pet);
            const targetPosition = this.getClampedPetPosition(
                pet,
                pet.x + pointer.velocity.x * this.TWEEN_ACCELERATION,
                pet.y + pointer.velocity.y * this.TWEEN_ACCELERATION
            );

            // add tween effect when drag end for smooth throw effect
            const tween = this.tweens.add({
                targets: pet,
                x: targetPosition.x,
                y: targetPosition.y,
                duration: 600,
                ease: Ease.QuartEaseOut,
                onComplete: () => {
                    pet.activeTween = undefined;
                    if (!pet.active || !pet.body) return;

                    this.clampPetToWorld(pet, false);
                    pet.body.enable = true;
                    pet.body.updateFromGameObject();

                    // Body state is updated on the next physics step. Delay only
                    // the direction restore, not the boundary correction.
                    this.schedulePetTimer(pet, 50, () => {
                        if (!pet.anims) return;
                        switch (pet.anims.getName()) {
                            case this.configManager.getStateName("climb", pet):
                                this.updateDirection(pet, Direction.UP);
                                break;
                            case this.configManager.getStateName("crawl", pet):
                                this.updateDirection(
                                    pet,
                                    pet.scaleX < 0
                                        ? Direction.UPSIDELEFT
                                        : Direction.UPSIDERIGHT
                                );
                                break;
                        }
                    });

                    this.petBeyondScreenSwitchClimb(
                        pet,
                        this.getPetWorldBounding(pet)
                    );
                },
            });
            pet.activeTween = tween;
        });

        this.physics.world.on(
            "worldbounds",
            (
                body: Phaser.Physics.Arcade.Body,
                up: boolean,
                down: boolean,
                left: boolean,
                right: boolean
            ) => {
                const pet = body.gameObject as Pet;
                if (!pet || !pet.active) return;
                // if crawl to world bounds, we make the pet jump or spawn on the ground
                if (
                    pet.anims &&
                    pet.anims.getName() ===
                        this.configManager.getStateName("crawl", pet)
                ) {
                    if (left || right) {
                        this.petJumpOrPlayRandomState(pet);
                    }
                    return;
                }

                if (up) {
                    if (!this.allowPetClimbing) {
                        this.petJumpOrPlayRandomState(pet);
                        return;
                    }

                    if (pet.availableStates.includes("crawl")) {
                        this.switchState(pet, "crawl");
                        return;
                    }
                    this.petJumpOrPlayRandomState(pet);
                } else if (down) {
                    this.switchStateAfterPetJump(pet);
                    this.petOnTheGroundPlayRandomState(pet);
                }

                /*
                 * this will check on the ground and mid air if pet is beyond screen
                 * and change pet state accordingly
                 */
                this.petBeyondScreenSwitchClimb(pet, {
                    up: up,
                    down: down,
                    left: left,
                    right: right,
                });
            }
        );

        // listen to setting change from setting window and update settings
        listen<any>(
            EventType.SettingWindowToPetOverlay,
            (event: TRenderEventListener) => {
                switch (event.payload.dispatchType) {
                    case DispatchType.SwitchAllowPetInteraction:
                        this.allowPetInteraction = event.payload
                            .value as boolean;
                        break;
                    case DispatchType.SwitchPetAboveTaskbar:
                        this.allowPetAboveTaskbar = event.payload
                            .value as boolean;
                        this.updatePetAboveTaskbar();

                        // when the user switch from pet above taskbar to not above taskbar, there will be a little space for pet, we force pet to jump or play random state
                        if (!this.allowPetAboveTaskbar) {
                            this.pets.forEach((pet) => {
                                this.petJumpOrPlayRandomState(pet);
                            });
                        }

                        break;
                    case DispatchType.AddPet:
                        this.addPet(
                            event.payload!.value as ISpriteConfig,
                            this.pets.length
                        );
                        break;
                    case DispatchType.RemovePet:
                        this.removePet(event.payload.value as string);
                        break;
                    case DispatchType.OverridePetScale:
                        this.allowOverridePetScale = event.payload
                            .value as boolean;
                        this.allowOverridePetScale
                            ? this.scaleAllPets(this.petScale)
                            : this.scaleAllPets(defaultSettings.petScale);
                        break;
                    case DispatchType.SwitchAllowPetClimbing:
                        this.allowPetClimbing = event.payload.value as boolean;

                        // when the user switch from pet climb to not climb, we force pet to jump or play random state
                        if (!this.allowPetClimbing) {
                            this.pets.forEach((pet) => {
                                this.petJumpOrPlayRandomState(pet);
                            });
                        }
                        break;
                    case DispatchType.ChangePetScale:
                        this.petScale = event.payload.value as number;
                        this.scaleAllPets(this.petScale);
                        break;
                    default:
                        break;
                }
            }
        ).then((unlisten) => {
            if (this.settingListenerCancelled) {
                unlisten();
            } else {
                this.settingUnlisten = unlisten;
            }
        }).catch((err) => error(err));

        info("Pets scene loaded");
    }

    update(time: number, delta: number): void {
        // Keep the remainder so the 9 Hz behavior does not drift when the
        // Phaser loop runs at 60 Hz or when frame times are uneven.
        this.frameCount += Math.min(delta, 250);

        if (this.frameCount >= this.UPDATE_DELAY) {
            this.frameCount %= this.UPDATE_DELAY;
            if (this.allowPetInteraction) {
                this.inputManager.checkIsMouseInOnPet();
            }

            this.randomJumpIfPetClimbAndCrawl();
        }

        // Force pets to stay within screen bounds
        this.pets.forEach((pet) => {
            // Dragging and the controlled jump tween intentionally run with
            // the body disabled. Their final position is clamped on release.
            if (!pet || !pet.body || !pet.body.enable) return;
            this.clampPetToWorld(pet);
        });
    }

    private handleScaleResize = (): void => {
        this.updatePetAboveTaskbar();
        this.pets.forEach((pet) => this.clampPetToWorld(pet, false));
    };

    private schedulePetTimer(
        pet: Pet,
        delay: number,
        callback: () => void
    ): Phaser.Time.TimerEvent {
        let timer: Phaser.Time.TimerEvent;
        timer = this.time.delayedCall(delay, () => {
            pet.timers = pet.timers?.filter((item) => item !== timer);
            if (pet.active) callback();
        });
        pet.timers = [...(pet.timers ?? []), timer];
        return timer;
    }

    private stopPetTween(pet: Pet): void {
        if (pet.activeTween) {
            pet.activeTween.stop();
            pet.activeTween = undefined;
        }
    }

    private clearPetAsyncState(pet: Pet): void {
        pet.timers?.forEach((timer) => timer.remove(false));
        pet.timers = [];
        this.stopPetTween(pet);

        if (pet.fallCompleteHandler && pet.anims) {
            const fallKey = this.configManager.getStateName("fall", pet);
            pet.off(
                `animationcomplete-${fallKey}`,
                pet.fallCompleteHandler
            );
            pet.fallCompleteHandler = undefined;
        }
    }

    private getClampedPetPosition(
        pet: Pet,
        x: number,
        y: number
    ): { x: number; y: number } {
        const minX = this.getPetLeftPosition(pet);
        const maxX = Math.max(minX, this.getPetRightPosition(pet));
        const minY = this.getPetTopPosition(pet);
        const maxY = Math.max(minY, this.getPetGroundPosition(pet));

        return {
            x: Phaser.Math.Clamp(x, minX, maxX),
            y: Phaser.Math.Clamp(y, minY, maxY),
        };
    }

    private clampPetToWorld(pet: Pet, stopMovement: boolean = true): void {
        if (!pet || !pet.body) return;

        const position = this.getClampedPetPosition(pet, pet.x, pet.y);
        const changed = position.x !== pet.x || position.y !== pet.y;

        if (!changed) return;

        pet.setPosition(position.x, position.y);
        pet.body.updateFromGameObject();
        if (stopMovement) pet.setVelocity(0, 0);
    }

    private getPetWorldBounding(pet: Pet): IWorldBounding {
        return {
            up: this.getPetBoundTop(pet),
            down: this.getPetBoundDown(pet),
            left: this.getPetBoundLeft(pet),
            right: this.getPetBoundRight(pet),
        };
    }

    shutdown(): void {
        this.settingListenerCancelled = true;
        this.settingUnlisten?.();
        this.settingUnlisten = undefined;
        this.scale.off("resize", this.handleScaleResize, this);
        this.pets.forEach((pet) => this.clearPetAsyncState(pet));
    }

    addPet(sprite: ISpriteConfig, index: number): void {
        this.configManager.registerSpriteStateAnimation(sprite);

        const randomX = Phaser.Math.Between(
            0,
            Math.max(0, this.physics.world.bounds.width)
        );
        // make the pet jump from the top of the screen
        const petY = 0 + this.configManager.getFrameSize(sprite).frameHeight;
        this.pets[index] = this.physics.add
            .sprite(randomX, petY, sprite.name)
            .setInteractive({
                draggable: true,
                pixelPerfect: true,
            }) as Pet;

        this.allowOverridePetScale
            ? this.scalePet(this.pets[index], this.petScale)
            : this.scalePet(this.pets[index], defaultSettings.petScale);

        this.clampPetToWorld(this.pets[index], false);
        this.pets[index].setCollideWorldBounds(true, 0, 0, true);

        // store available states to pet (it actual name, not modified name)
        this.pets[index].availableStates = Object.keys(sprite.states);
        this.pets[index].canPlayRandomState = true;
        this.pets[index].canRandomFlip = true;
        this.pets[index].id = sprite.id as string;

        this.petJumpOrPlayRandomState(this.pets[index]);
    }

    removePet(petId: string): void {
        this.pets = this.pets.filter((pet: Pet, index: number) => {
            if (pet.id === petId) {
                this.clearPetAsyncState(pet);
                pet.destroy();

                // get pet that use the same texture as the pet that is destroyed
                const petsWithSameTexture = this.pets.filter(
                    (pet: Pet) =>
                        pet.texture.key === this.pets[index].texture.key
                );

                // remove texture if there is only one pet that use the texture because we don't need it anymore
                if (petsWithSameTexture.length === 1) {
                    this.textures.remove(pet.texture.key);
                }

                // remove index from petClimbAndCrawlIndex if it exist because the pet is destroyed
                if (this.petClimbAndCrawlIndex.includes(index)) {
                    this.petClimbAndCrawlIndex =
                        this.petClimbAndCrawlIndex.filter((i) => i !== index);
                }
                return false;
            }
            return true;
        });
    }

    updateDirection(pet: Pet, direction: Direction): void {
        pet.direction = direction;
        this.updateMovement(pet);
    }

    updateStateDirection(pet: Pet, state: string): void {
        let direction = Direction.UNKNOWN;

        switch (state) {
            case "walk":
                // if pet.scaleX is negative, it means pet is facing left, so we set direction to left, else right
                direction = pet.scaleX < 0 ? Direction.LEFT : Direction.RIGHT;
                break;
            case "jump":
                // feel like jump state is opposite of walk so every jump, i flip the pet horizontally :)
                this.toggleFlipX(pet);
                direction = Direction.DOWN;
                break;
            case "climb":
                direction = Direction.UP;
                break;
            case "crawl":
                pet.scaleX > 0
                    ? (direction = Direction.UPSIDELEFT)
                    : (direction = Direction.UPSIDERIGHT);
                break;
            default:
                direction = Direction.UNKNOWN;
                break;
        }

        this.updateDirection(pet, direction);
    }

    // this function will be called every time we update the pet direction using updateDirection
    updateMovement(pet: Pet): void {
        switch (pet.direction) {
            case Direction.RIGHT:
                pet.setVelocity(this.PET_MOVE_VELOCITY, 0);
                pet.setAcceleration(0);
                this.setPetLookToTheLeft(pet, false);
                break;
            case Direction.LEFT:
                pet.setVelocity(-this.PET_MOVE_VELOCITY, 0);
                pet.setAcceleration(0);
                this.setPetLookToTheLeft(pet, true);
                break;
            case Direction.UP:
                pet.setVelocity(0, -this.PET_MOVE_VELOCITY);
                pet.setAcceleration(0);
                break;
            case Direction.DOWN:
                pet.setVelocity(0, this.PET_MOVE_VELOCITY);
                pet.setAcceleration(0, this.PET_MOVE_ACCELERATION);
                break;
            case Direction.UPSIDELEFT:
                pet.setVelocity(-this.PET_MOVE_VELOCITY);
                pet.setAcceleration(0);
                this.setPetLookToTheLeft(pet, true);
                break;
            case Direction.UPSIDERIGHT:
                pet.setVelocity(
                    this.PET_MOVE_VELOCITY,
                    -this.PET_MOVE_VELOCITY
                );
                pet.setAcceleration(0);
                this.setPetLookToTheLeft(pet, false);
                break;
            case Direction.UNKNOWN:
                pet.setVelocity(0);
                pet.setAcceleration(0);
                break;
            default:
                pet.setVelocity(0);
                pet.setAcceleration(0);
                break;
        }

        // if pet is going up, we disable gravity, if pet is going down, we enable gravity
        const isMovingUp = [
            Direction.UP,
            Direction.UPSIDELEFT,
            Direction.UPSIDERIGHT,
        ].includes(pet.direction as Direction);

        // Set the gravity according to the direction
        // @ts-ignore
        pet.body!.setAllowGravity(!isMovingUp);

        // Set the horizontal velocityX to zero if the direction is up
        if (pet.direction === Direction.UP) {
            pet.setVelocityX(0);
        }
    }

    switchState(
        pet: Pet,
        state: string,
        options: ISwitchStateOptions = {
            repeat: -1,
            delay: 0,
            repeatDelay: 0,
        }
    ): void {
        try {
            // Delayed callbacks can run after a pet has been removed.
            if (!pet.anims) return;

            // prevent pet from playing crawl and climb state if allowPetClimbing is false
            if (!this.allowPetClimbing) {
                if (state === "climb" || state === "crawl") return;
            }

            const animationKey = this.configManager.getStateName(state, pet);
            // if current state is the same as the new state, do nothing
            if (pet.anims && pet.anims.getName() === animationKey) return;
            if (!pet.availableStates.includes(state)) return;

            if (state !== "fall" && pet.fallCompleteHandler) {
                const fallKey = this.configManager.getStateName("fall", pet);
                pet.off(
                    `animationcomplete-${fallKey}`,
                    pet.fallCompleteHandler
                );
                pet.fallCompleteHandler = undefined;
            }

            pet.anims.play({
                key: animationKey,
                repeat: options.repeat,
                delay: options.delay,
                repeatDelay: options.repeatDelay,
            });

            if (state === "climb" || state === "crawl") {
                this.petClimbAndCrawlIndex.push(this.pets.indexOf(pet));
            } else {
                this.petClimbAndCrawlIndex = this.petClimbAndCrawlIndex.filter(
                    (index) => index !== this.pets.indexOf(pet)
                );
            }

            this.updateStateDirection(pet, state);
        } catch (err: any) {
            // error could happen when trying to get name
            error(err);
        }
    }

    // if lookToTheLeft is true, pet will look to the left, if false, pet will look to the right
    setPetLookToTheLeft(pet: Pet, lookToTheLeft: boolean): void {
        if (lookToTheLeft) {
            if (pet.scaleX > 0) {
                this.toggleFlipX(pet);
            }
            return;
        }

        if (pet.scaleX < 0) {
            this.toggleFlipX(pet);
        }
    }

    scalePet(pet: Pet, scaleValue: number): void {
        const scaleX = pet.scaleX > 0 ? scaleValue : -scaleValue;
        const scaleY = pet.scaleY > 0 ? scaleValue : -scaleValue;
        pet.setScale(scaleX, scaleY);
        this.clampPetToWorld(pet, false);
    }

    scaleAllPets(scaleValue: number): void {
        this.pets.forEach((pet) => {
            this.scalePet(pet, scaleValue);

            // force pet to jump or play random state when scale change
            this.petJumpOrPlayRandomState(pet);
        });
    }

    toggleFlipX(pet: Pet): void {
        /*
         * using scale because flipX doesn't flip the hitbox
         * so i have to flip the hitbox manually
         * Note: scaleX negative (- value) = direction left, scaleX positive (+ value) = direction right
         */
        // if hitbox is on the right, flip to the left
        pet.scaleX > 0 ? pet.setOffset(pet.width, 0) : pet.setOffset(0, 0);
        pet.setScale(pet.scaleX * -1, pet.scaleY);
    }

    toggleFlipXThenUpdateDirection(pet: Pet): void {
        this.toggleFlipX(pet);

        switch (pet.direction) {
            case Direction.RIGHT:
                this.updateDirection(pet, Direction.LEFT);
                break;
            case Direction.LEFT:
                this.updateDirection(pet, Direction.RIGHT);
                break;
            case Direction.UPSIDELEFT:
                this.updateDirection(pet, Direction.UPSIDERIGHT);
                break;
            case Direction.UPSIDERIGHT:
                this.updateDirection(pet, Direction.UPSIDELEFT);
                break;
            default:
                break;
        }
    }

    getOneRandomState(pet: Pet): string {
        const availableRandomStates = pet.availableStates.filter(
            (state) => !this.FORBIDDEN_RAND_STATE.includes(state)
        );

        if (availableRandomStates.length === 0) {
            return pet.availableStates[0] ?? "stand";
        }

        return availableRandomStates[
            Phaser.Math.Between(0, availableRandomStates.length - 1)
        ];
    }

    getOneRandomStateByPet(pet: Pet): string {
        return this.getOneRandomState(pet);
    }

    playRandomState(pet: Pet): void {
        if (!pet.canPlayRandomState) return;

        this.switchState(pet, this.getOneRandomState(pet));
        pet.canPlayRandomState = false;

        // add delay to prevent spamming random state too fast
        this.schedulePetTimer(pet, this.RAND_STATE_DELAY, () => {
            pet.canPlayRandomState = true;
        });
    }

    // this function is for when pet jump to the ground, it will call every time pet hit the ground
    switchStateAfterPetJump(pet: Pet): void {
        if (!pet) return;
        if (
            pet.anims &&
            pet.anims.getName() !== this.configManager.getStateName("jump", pet)
        )
            return;

        if (pet.availableStates.includes("fall")) {
            this.switchState(pet, "fall", {
                repeat: 0,
            });

            // after fall animation complete, we play random state
            pet.canPlayRandomState = false;
            const fallKey = this.configManager.getStateName("fall", pet);
            if (pet.fallCompleteHandler) {
                pet.off(
                    `animationcomplete-${fallKey}`,
                    pet.fallCompleteHandler
                );
            }

            pet.fallCompleteHandler = () => {
                pet.fallCompleteHandler = undefined;
                pet.canPlayRandomState = true;
                this.playRandomState(pet);
            };
            pet.once(
                `animationcomplete-${fallKey}`,
                pet.fallCompleteHandler
            );

            return;
        }
        this.playRandomState(pet);
    }

    getPetGroundPosition(pet: Pet): number {
        return (
            this.physics.world.bounds.height -
            pet.displayHeight * pet.originY
        );
    }

    getPetTopPosition(pet: Pet): number {
        return pet.displayHeight * pet.originY;
    }

    getPetLeftPosition(pet: Pet): number {
        return pet.displayWidth * pet.originX;
    }

    getPetRightPosition(pet: Pet): number {
        return (
            this.physics.world.bounds.width -
            pet.displayWidth * pet.originX
        );
    }

    getPetBoundDown(pet: Pet): boolean {
        // we have to check * with scaleY because sometimes user scale the pet
        return pet.y >= this.getPetGroundPosition(pet);
    }

    getPetBoundLeft(pet: Pet): boolean {
        // Add extra margin to prevent pet from going off-screen
        const margin = 10;
        return pet.x <= this.getPetLeftPosition(pet) + margin;
    }

    getPetBoundRight(pet: Pet): boolean {
        // Add extra margin to prevent pet from going off-screen
        const margin = 10;
        return pet.x >= this.getPetRightPosition(pet) - margin;
    }

    getPetBoundTop(pet: Pet): boolean {
        return pet.y <= this.getPetTopPosition(pet);
    }

    updatePetAboveTaskbar(): void {
        const worldWidth = Math.max(1, this.scale.width || window.innerWidth);
        const worldHeight = Math.max(1, this.scale.height || window.innerHeight);
        const screenHeight = Math.max(1, window.screen.height || worldHeight);
        const availableHeight = Math.max(
            1,
            window.screen.availHeight || screenHeight
        );
        const availableRatio = Math.min(1, availableHeight / screenHeight);
        const height = this.allowPetAboveTaskbar
            ? worldHeight
            : Math.max(1, worldHeight * availableRatio);

        this.physics.world.setBounds(
            0,
            0,
            worldWidth,
            height
        );
        this.clampAllPets();
    }

    private clampAllPets(): void {
        this.pets.forEach((pet) => {
            if (pet?.body?.enable) this.clampPetToWorld(pet);
        });
    }

    petJumpOrPlayRandomState(pet: Pet): void {
        if (!pet) return;

        if (pet.availableStates.includes("jump")) {
            this.switchState(pet, "jump");
            return;
        }

        this.switchState(pet, this.getOneRandomState(pet));
    }

    petOnTheGroundPlayRandomState(pet: Pet): void {
        if (!pet) {
            return;
        }

        switch (pet.anims.getName()) {
            case this.configManager.getStateName("climb", pet):
                return;
            case this.configManager.getStateName("crawl", pet):
                return;
            case this.configManager.getStateName("drag", pet):
                return;
            case this.configManager.getStateName("jump", pet):
                return;
        }

        const random = Phaser.Math.Between(0, 1000);
        if (
            pet.anims &&
            pet.anims.getName() === this.configManager.getStateName("walk", pet)
        ) {
            if (random >= 0 && random <= 10) {
                const idleState = pet.availableStates.includes("idle")
                    ? "idle"
                    : pet.availableStates.includes("stand")
                        ? "stand"
                        : undefined;
                if (!idleState) return;

                this.switchState(pet, idleState);
                this.schedulePetTimer(
                    pet,
                    Phaser.Math.Between(2000, 4000),
                    () => {
                        if (
                            pet.anims &&
                            pet.anims.getName() !==
                                this.configManager.getStateName(idleState, pet)
                        ) return;
                        this.switchState(pet, "walk");
                    }
                );
                return;
            }
        } else {
            // enhance random state if pet is not walk
            if (random >= 400 && random <= 450) {
                this.playRandomState(pet);
                return;
            }
        }

        // just some random number to play random state
        if (random >= 480 && random <= 490) {
            // allow random flip only after pet flipped "FLIP_DELAY" time
            if (pet.canRandomFlip) {
                this.toggleFlipXThenUpdateDirection(pet);
                pet.canRandomFlip = false;

                // add delay to prevent spamming pet flip too fast
                this.schedulePetTimer(pet, this.FLIP_DELAY, () => {
                    pet.canRandomFlip = true;
                });
            }
        } else if (random >= 350 && random <= 365) {
            this.playRandomState(pet);
        } else if (random >= 100 && random <= 120) {
            this.switchState(pet, "walk");
        }
    }

    randomJumpIfPetClimbAndCrawl(): void {
        if (this.petClimbAndCrawlIndex.length === 0) return;

        for (const index of this.petClimbAndCrawlIndex) {
            const pet = this.pets[index];
            if (!pet) continue;

            switch (pet.anims.getName()) {
                case this.configManager.getStateName("drag", pet):
                    continue;
                case this.configManager.getStateName("jump", pet):
                    continue;
            }

            const random = Phaser.Math.Between(0, 500);

            if (random === 78) {
                const minX = this.getPetLeftPosition(pet);
                const maxX = Math.max(minX, this.getPetRightPosition(pet));
                const currentX = Phaser.Math.Clamp(pet.x, minX, maxX);
                let newPetx = currentX;
                // if pet climb, I want the pet to have some opposite x direction when jump
                if (
                    pet.anims &&
                    pet.anims.getName() ===
                        this.configManager.getStateName("climb", pet)
                ) {
                    // if pet.scaleX is negative, it means pet is facing left, vice versa
                    newPetx =
                        pet.scaleX < 0
                            ? Phaser.Math.Between(minX, currentX)
                            : Phaser.Math.Between(
                                  currentX,
                                  maxX
                              );
                }

                // disable body to prevent shaking when jump
                if (pet.body!.enable) pet.body!.enable = false;
                this.stopPetTween(pet);
                this.switchState(pet, "jump");
                // use tween animation to make jump more smooth
                const tween = this.tweens.add({
                    targets: pet,
                    x: newPetx,
                    y: this.getPetGroundPosition(pet),
                    duration: 3000,
                    ease: Ease.QuadEaseOut,
                    onComplete: () => {
                        pet.activeTween = undefined;
                        if (!pet.active || !pet.body) return;
                        this.clampPetToWorld(pet, false);
                        pet.body.enable = true;
                        pet.body.updateFromGameObject();
                        this.switchStateAfterPetJump(pet);
                    },
                });
                pet.activeTween = tween;
                return;
            }

            // add random pause when climb
            if (random >= 0 && random <= 5) {
                if (
                    pet.anims &&
                    pet.anims.getName() ===
                        this.configManager.getStateName("climb", pet)
                ) {
                    pet.anims.pause();
                    this.updateDirection(pet, Direction.UNKNOWN);
                    // @ts-ignore
                    pet.body!.allowGravity = false;
                    this.schedulePetTimer(
                        pet,
                        Phaser.Math.Between(3000, 6000),
                        () => {
                        if (
                            pet.anims &&
                            pet.anims.getName() ===
                                this.configManager.getStateName("climb", pet) &&
                            !pet.anims.isPlaying
                        ) {
                            pet.anims.resume();
                            this.updateDirection(pet, Direction.UP);
                        }
                        }
                    );
                    return;
                } else if (
                    pet.anims &&
                    pet.anims.getName() ===
                        this.configManager.getStateName("crawl", pet)
                ) {
                    // add random pause when crawl
                    pet.anims.pause();
                    this.updateDirection(pet, Direction.UNKNOWN);
                    // @ts-ignore
                    pet.body!.allowGravity = false;
                    this.schedulePetTimer(
                        pet,
                        Phaser.Math.Between(3000, 6000),
                        () => {
                        if (
                            pet.anims &&
                            pet.anims.getName() ===
                                this.configManager.getStateName("crawl", pet) &&
                            !pet.anims.isPlaying
                        ) {
                            pet.anims.resume();
                            // if pet.scaleX is negative, it means pet is facing up side left, vice versa
                            this.updateDirection(
                                pet,
                                pet.scaleX < 0
                                    ? Direction.UPSIDELEFT
                                    : Direction.UPSIDERIGHT
                            );
                        }
                        }
                    );
                    return;
                }
            }
        }
    }

    petBeyondScreenSwitchClimb(pet: Pet, worldBounding: IWorldBounding): void {
        if (!pet || !pet.anims) return;

        // if pet is climb and crawl, we don't want to switch state again
        switch (pet.anims.getName()) {
            case this.configManager.getStateName("climb", pet):
                return;
            case this.configManager.getStateName("crawl", pet):
                return;
        }

        // ? debug only
        // pet.availableStates = pet.availableStates.filter(state => state !== 'climb');

        if (worldBounding.left || worldBounding.right) {
            if (
                pet.availableStates.includes("climb") &&
                this.allowPetClimbing
            ) {
                this.switchState(pet, "climb");

                const edgeX = worldBounding.left
                    ? this.getPetLeftPosition(pet)
                    : this.getPetRightPosition(pet);
                const edgeY = Phaser.Math.Clamp(
                    pet.y,
                    this.getPetTopPosition(pet),
                    this.getPetGroundPosition(pet)
                );
                pet.setPosition(edgeX, edgeY);
                pet.body.updateFromGameObject();
                worldBounding.left
                    ? this.setPetLookToTheLeft(pet, true)
                    : this.setPetLookToTheLeft(pet, false);
            } else {
                if (worldBounding.down) {
                    // if pet on the ground and beyond screen and doesn't have climb state, we flip the pet
                    this.toggleFlipXThenUpdateDirection(pet);
                } else {
                    // if pet bounding left or right and not on the ground, we make the pet jump or spawn on the ground
                    this.petJumpOrPlayRandomState(pet);
                }
            }
        } else {
            if (worldBounding.down) {
                // if pet is on the ground after being dragged and they are not bounding left or right, we play random state
                if (
                    pet.anims &&
                    pet.anims.getName() ===
                        this.configManager.getStateName("drag", pet)
                ) {
                    this.switchState(pet, this.getOneRandomState(pet));
                }
            } else {
                // if pet is not on the ground and they are not bounding left or right, we make the pet jump or spawn on the ground
                this.petJumpOrPlayRandomState(pet);
            }
        }
    }
}
