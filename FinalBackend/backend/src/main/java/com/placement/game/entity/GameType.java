package com.placement.game.entity;

/** The six cognitive-game categories. Adding another later is additive: a new enum value plus a
 *  new {@code com.placement.game.engine.RoundGenerator} implementation - nothing else in this
 *  module (entities, controllers, scoring) needs to change. */
public enum GameType {
    DEDUCTIVE,
    SWITCH,
    GRID,
    INDUCTIVE,
    MOTION,
    MATH
}
