"""Terminal Snake. Arrow keys / WASD to move, q to quit. Requires only the stdlib."""
import curses
import random
import time

DIRS = {
    curses.KEY_UP: (-1, 0), ord("w"): (-1, 0),
    curses.KEY_DOWN: (1, 0), ord("s"): (1, 0),
    curses.KEY_LEFT: (0, -1), ord("a"): (0, -1),
    curses.KEY_RIGHT: (0, 1), ord("d"): (0, 1),
}


def place_food(snake, h, w):
    free = [(y, x) for y in range(1, h - 1) for x in range(1, w - 1) if (y, x) not in snake]
    return random.choice(free) if free else None


def step(snake, direction, food, h, w):
    """Advance one tick. Returns (snake, food, alive)."""
    head = (snake[0][0] + direction[0], snake[0][1] + direction[1])
    grows = head == food
    body = snake if grows else snake[:-1]
    if not (0 < head[0] < h - 1 and 0 < head[1] < w - 1) or head in body:
        return snake, food, False
    snake = [head] + body
    if grows:
        food = place_food(snake, h, w)
    return snake, food, food is not None


def play(stdscr):
    curses.curs_set(0)
    stdscr.nodelay(True)
    stdscr.keypad(True)
    h, w = min(stdscr.getmaxyx()[0], 22), min(stdscr.getmaxyx()[1], 60)
    snake = [(h // 2, w // 2 - i) for i in range(3)]
    direction = (0, 1)
    food = place_food(snake, h, w)
    score, alive = 0, True

    while alive:
        key = stdscr.getch()
        if key == ord("q"):
            return score
        new = DIRS.get(key)
        if new and (new[0] + direction[0], new[1] + direction[1]) != (0, 0):
            direction = new

        old_len = len(snake)
        snake, food, alive = step(snake, direction, food, h, w)
        score += len(snake) > old_len

        stdscr.erase()
        stdscr.border()
        if food:
            stdscr.addch(*food, "*")
        for y, x in snake:
            stdscr.addch(y, x, "O")
        stdscr.addstr(0, 2, f" Score: {score} ")
        stdscr.refresh()
        # Vertical moves are visually faster in a terminal; compensate.
        time.sleep(0.16 if direction[0] else 0.09)
    return score


if __name__ == "__main__":
    print(f"Game over! Score: {curses.wrapper(play)}")
