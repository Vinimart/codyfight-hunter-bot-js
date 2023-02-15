import CBotConfig from "./modules/CBotConfig.js";
import GameUtils from "./modules/GameUtils.js";
import { sleep } from "../modules/utils.js";
import { GAME_STATUS_PLAYING } from "../modules/game-constants.js";

// CBot class is the main class for the bot.
// The bot algorithm is implemented in the playGame() method.
// Check the API documentation at https://codyfight.com/api-doc/.

export default class CBot extends CBotConfig {
  constructor(app, url, ckey, mode, i) {
    super(app, url, ckey, mode, i);
    this.gameUtils = new GameUtils();
  }

  // Main game loop
  async playGame() {
    while (this.game.state.status === GAME_STATUS_PLAYING) {
      if (this.game.players.bearer.is_player_turn) {
        await this.castSkills();
        await this.makeMove();
      } else {
        await sleep(1000);
        this.game = await this.gameAPI.check(this.ckey);
      }
    }
  }

  async makeMove() {
    if (this.game.players.bearer.is_player_turn) {
      let move = this.gameUtils.getRandomMove(this.game);

      const ryo = this.gameUtils.findSpecialAgent(1, this.game);
      const ripper = this.gameUtils.findSpecialAgent(4, this.game);
      const buzz = this.gameUtils.findSpecialAgent(5, this.game);

      const exit = this.gameUtils.getClosestExit(this.game);

      const isRipperNearby = this.gameUtils.isNearby(
        this.game.players.bearer?.position,
        ripper?.position,
        3
      );

      const isRyoCloser = this.gameUtils.isCloser(
        this.game?.players?.bearer?.position,
        ryo?.position,
        exit
      );

      const isOpponentCloserToExit = this.gameUtils.isCloser(
        exit,
        this.game?.players?.opponent?.position,
        this.game?.players?.bearer?.position
      );

      const avoidRipper = () => {
        move = this.gameUtils.getFarthestDistanceMove(
          ripper?.position,
          this.game
        );

        console.log("💀 Avoiding Ripper");
      };

      const goToExit = () => {
        move = this.gameUtils.getShortestDistanceMove([exit], this.game);

        console.log("❎ Finding Exit");
      };

      const goToRyo = () => {
        if (exit && !isRyoCloser && !isOpponentCloserToExit) return goToExit();

        move = this.gameUtils.getShortestDistanceMove(
          [ryo?.position],
          this.game
        );

        console.log("🐽 Seeking Ryo");
      };

      const goRandom = () => {
        move = this.gameUtils.getRandomMove(this.game);

        console.log("🏖 Just chilling");
      };

      if (ripper && isRipperNearby) avoidRipper();
      else if (ryo && buzz) goToRyo();
      else if (exit) goToExit();
      else goRandom();

      this.game = await this.gameAPI.move(this.ckey, move?.x, move?.y);
    }
  }

  async castSkills() {
    for (const skill of this.game.players.bearer.skills) {
      if (skill.status !== 1 || skill.possible_targets.length === 0) continue;

      let target;

      if (skill.id === 7 || skill.id === 0) {
        // Blink and Demolish towards the exit
        const exit = this.gameUtils.getClosestExit(this.game);

        const bestTarget = this.gameUtils.getTargetTowardsExit(
          skill.possible_targets,
          exit
        );

        const isTargetExit =
          exit?.x === bestTarget?.x && exit?.y === bestTarget?.y;

        if (skill.id === 0 && isTargetExit) continue;

        target = bestTarget;
      } else {
        target = this.gameUtils.getRandomTarget(skill.possible_targets);
      }

      if (skill.possible_targets.includes(target)) {
        this.game = await this.gameAPI.cast(
          this.ckey,
          skill.id,
          target?.x,
          target?.y
        );

        console.log(
          `⚡️ Casting ${skill.name} in x:${target?.x}, y:${target?.y}`
        );
      }
    }
  }
}
