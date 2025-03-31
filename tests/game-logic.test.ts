import { assertEquals } from "https://deno.land/std@0.210.0/assert/mod.ts";
import * as gameLogic from "../services/game-logic.ts";
import * as gameModel from "../models/game.ts";
import * as authService from "../services/auth.ts";
import * as gamePhase from "../services/game-phase.ts";
import { Game, Role } from "../types/game.ts";

let testGame: Game;

async function setupTest() {
  // Reset game state
  gameModel.resetGames();
  authService.resetStore();
  gamePhase.clearAllTimers();

  // Create test users
  const users = await Promise.all([
    authService.register({
      username: "owner",
      email: "owner@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player2",
      email: "player2@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player3",
      email: "player3@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player4",
      email: "player4@test.com",
      password: "password123",
    }),
    authService.register({
      username: "player5",
      email: "player5@test.com",
      password: "password123",
    }),
  ]);

  // Create test game
  testGame = await gameModel.createGame({
    name: "Test Game",
    maxPlayers: 5,
  }, users[0].id);

  // Add players to game
  for (let i = 1; i < users.length; i++) {
    await gameModel.joinGame(testGame.id, users[i].id);
  }

  // Initialize game without scheduling timers
  testGame.status = "IN_PROGRESS";
  testGame.currentDay = 1;
  testGame.currentPhase = "DAY_DISCUSSION";
  gameLogic.assignRoles(testGame);
}

function cleanupTest() {
  gamePhase.clearAllTimers();
}

// Game end condition tests
Deno.test({
  name: "checkGameEnd - should detect villager victory when all werewolves are dead",
  async fn() {
    await setupTest();
    // Set up roles
    testGame.players[0].role = "VILLAGER";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "SEER";
    testGame.players[3].role = "BODYGUARD";
    testGame.players[4].role = "VILLAGER";

    // Kill werewolf
    testGame.players[1].isAlive = false;

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertEquals(result.winner, "VILLAGERS");

    cleanupTest();
  },
});

Deno.test({
  name: "checkGameEnd - should detect werewolf victory when werewolves equal or outnumber villagers",
  async fn() {
    await setupTest();
    // Set up roles
    testGame.players[0].role = "WEREWOLF";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "VILLAGER";
    testGame.players[3].role = "VILLAGER";
    testGame.players[4].role = "SEER";

    // Kill villagers and seer
    testGame.players[2].isAlive = false;
    testGame.players[3].isAlive = false;
    testGame.players[4].isAlive = false;

    const result = gameLogic.checkGameEnd(testGame);
    assertEquals(result.isEnded, true);
    assertEquals(result.winner, "WEREWOLVES");

    cleanupTest();
  },
});

// Phase transition tests
Deno.test({
  name: "handlePhaseEnd - should correctly transition between phases",
  async fn() {
    await setupTest();
    
    // Ensure enough players per team to avoid early game end
    testGame.players[0].role = "VILLAGER";
    testGame.players[1].role = "WEREWOLF";
    testGame.players[2].role = "SEER"; 
    testGame.players[3].role = "BODYGUARD";
    testGame.players[4].role = "VILLAGER";
    
    // Test DAY_DISCUSSION to DAY_VOTE
    testGame.currentPhase = "DAY_DISCUSSION";
    
    // First transition test: DAY_DISCUSSION to DAY_VOTE
    const nextPhase = gameLogic._getNextPhase(testGame.currentPhase);
    assertEquals(nextPhase, "DAY_VOTE");
    
    // Second transition test: DAY_VOTE to NIGHT
    const nightPhase = gameLogic._getNextPhase("DAY_VOTE");
    assertEquals(nightPhase, "NIGHT");
    
    // Third transition test: NIGHT to DAY_DISCUSSION
    const dayPhase = gameLogic._getNextPhase("NIGHT");
    assertEquals(dayPhase, "DAY_DISCUSSION");
    
    cleanupTest();
  },
});

// Role assignment tests
Deno.test({
  name: "assignRoles - should assign roles according to game settings",
  async fn() {
    await setupTest();

    // Reset all roles
    testGame.players.forEach((player) => {
      player.role = undefined;
    });

    gameLogic.assignRoles(testGame);

    const roleCount = {
      WEREWOLF: 0,
      SEER: 0,
      BODYGUARD: 0,
      VILLAGER: 0,
      MEDIUM: 0,
    } as Record<Role, number>;

    testGame.players.forEach((player) => {
      if (player.role) {
        roleCount[player.role]++;
      }
    });

    assertEquals(roleCount.WEREWOLF, testGame.settings.roles.werewolfCount);
    assertEquals(roleCount.SEER, testGame.settings.roles.seerCount);
    assertEquals(roleCount.BODYGUARD, testGame.settings.roles.bodyguardCount);
    assertEquals(roleCount.MEDIUM, testGame.settings.roles.mediumCount);
    assertEquals(
      roleCount.VILLAGER,
      testGame.players.length - (
        testGame.settings.roles.werewolfCount +
        testGame.settings.roles.seerCount +
        testGame.settings.roles.bodyguardCount +
        testGame.settings.roles.mediumCount
      ),
    );

    cleanupTest();
  },
});
