# Skunk CLI

Install and manage Skunk Global AI skills and WordPress plugins.

## Installation

```bash
npm install -g @skunkceo/cli
```

## Quick Start

```bash
# Interactive setup wizard
skunk setup

# Install an AI skill (teaches your AI assistant)
skunk install skill skunkforms

# Install a WordPress plugin
skunk install plugin skunkforms

# Install Pro version with license
skunk install plugin skunkcrm-pro --license=YOUR_LICENSE_KEY
```

## Commands

| Command | Description |
|---------|-------------|
| `skunk setup` | Interactive setup wizard |
| `skunk install skill <name>` | Install an AI skill |
| `skunk install plugin <name>` | Install a WordPress plugin |
| `skunk remove skill <name>` | Remove an installed skill |
| `skunk list` | List installed skills |
| `skunk available` | List available skills |
| `skunk plugins` | List available plugins |
| `skunk update` | Update CLI and refresh skills |
| `skunk help` | Show help |

## Skills vs Plugins

**Skills** teach your AI assistant (OpenClaw, Claude, etc.) how to work with Skunk products. They're installed to `~/.openclaw/skills/`.

**Plugins** are the actual WordPress plugins that run on your site. They're installed via WP-CLI or WordPress Studio.

For the best experience, install both:
```bash
# Install the skill so your AI knows how to use it
skunk install skill skunkforms

# Install the plugin on your WordPress site
skunk install plugin skunkforms
```

## Available Products

- **skunkcrm** / **skunkcrm-pro** - CRM & contact management
- **skunkforms** / **skunkforms-pro** - Form builder
- **skunkpages** / **skunkpages-pro** - Landing page builder

## Requirements

- Node.js 18+
- For plugin installation: WP-CLI or WordPress Studio

## Links

- [OpenClaw WordPress Guide](https://skunkglobal.com/guides/openclaw-wordpress)
- [Skunk Global](https://skunkglobal.com)
