# Repository Guidelines

## Project Structure & Module Organization
- `src/index.ts` boots the Discord client and loads slash commands.
- `src/deploy-commands.ts` registers slash commands with Discord.
- `src/commands/utility/` contains command implementations such as `ping.ts` and `wobs.ts`.
- `src/commands/utility/wobs.helpers.ts` holds reusable WoB formatting, pagination, and backend helpers.
- `src/@types/discord.d.ts` extends Discord.js types.
- Build output goes to `dist/` and should not be edited by hand.

## Build, Test, and Development Commands
- `pnpm dev` runs the bot locally with `.env` loaded and watches `src/index.ts`.
- `pnpm deploycommands` syncs slash commands to Discord.
- `pnpm build` compiles TypeScript to `dist/`.
- `pnpm start` runs the compiled bot from `dist/index.js`.
- `pnpm lint` runs ESLint across the repo.
- `pnpm format` formats the codebase with Prettier.

## Coding Style & Naming Conventions
- Use TypeScript, ES modules, and explicit types where they clarify intent.
- Keep indentation and formatting consistent with Prettier defaults.
- Prefer `camelCase` for variables/functions, `PascalCase` for interfaces, and `SCREAMING_SNAKE_CASE` for constants.
- Place command-specific logic in `src/commands/<group>/` and move shared helpers into sibling `*.helpers.ts` files when a command grows large.

## Testing Guidelines
- There is no test suite yet. Before opening a PR, run `pnpm build` and `pnpm lint`.
- If you add tests later, keep them close to the feature they cover and name them by behavior, not implementation.

## Commit & Pull Request Guidelines
- Keep commit messages short, imperative, and specific, matching the existing history style (`basic ping command`, `initial files`).
- PRs should include a clear summary, the commands you ran, and screenshots or Discord examples when UI behavior changes.
- Note any environment requirements, especially `.env` values such as bot token, client ID, guild ID, and backend URL.

## Configuration Notes
- Do not commit secrets or generated files.
- The bot expects a working Discord application and a reachable backend configured through environment variables.
