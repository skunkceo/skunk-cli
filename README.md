# Skunk CLI

Install and manage [Skunk Global](https://skunkglobal.com) skills for [OpenClaw](https://openclaw.ai).

## Installation

```bash
npm install -g @skunkceo/cli
```

## Quick Start

```bash
skunk setup
```

This interactive wizard will:
1. Check your environment (Node.js, OpenClaw, WordPress Studio)
2. Install essential skills (WordPress, WooCommerce, SkunkCRM, SkunkForms, SkunkPages)
3. Guide you through next steps

## Commands

```bash
skunk setup              # Interactive setup wizard (start here!)
skunk install <skill>    # Install a specific skill
skunk remove <skill>     # Remove an installed skill
skunk list               # List installed skills
skunk available          # See all available skills
skunk help               # Show help
```

## What are Skills?

Skills teach OpenClaw how to use specific tools and services. Each skill contains instructions that help your AI assistant understand:

- What commands to run
- How to interpret results
- Best practices for the tool

After installing skills, restart OpenClaw to load them:

```bash
openclaw gateway restart
```

## Available Skills

Browse all skills at: https://github.com/skunkceo/openclaw-skills

## Guide

Full guide: https://skunkglobal.com/guides/openclaw-wordpress

## Links

- [Skunk Global](https://skunkglobal.com)
- [Skills Repository](https://github.com/skunkceo/openclaw-skills)
- [OpenClaw](https://openclaw.ai)
