package com.placement.game.entity;

/** Lifecycle of an admin-authored {@link Game} definition. Only PUBLISHED games are visible/
 *  startable by students. */
public enum GameStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED
}
