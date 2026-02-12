#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILLS_REPO = 'skunkceo/openclaw-skills';
const SKILLS_BRANCH = 'main';
const OPENCLAW_DIR = path.join(process.env.HOME, '.openclaw', 'skills');

const commands = {
  install: installSkill,
  list: listSkills,
  available: listAvailable,
  remove: removeSkill,
  help: showHelp,
};

const args = process.argv.slice(2);
const command = args[0] || 'help';
const skillName = args[1];

if (commands[command]) {
  commands[command](skillName);
} else {
  console.log(`Unknown command: ${command}`);
  showHelp();
}

function showHelp() {
  console.log(`
🦨 Skunk CLI - Install skills for OpenClaw

Usage:
  skunk install <skill>    Install a skill
  skunk remove <skill>     Remove an installed skill
  skunk list               List installed skills
  skunk available          List available skills
  skunk help               Show this help

Examples:
  skunk install wordpress-studio
  skunk install seo-analyzer
  skunk list

Skills: https://github.com/skunkceo/openclaw-skills
`);
}

function listSkills() {
  if (!fs.existsSync(OPENCLAW_DIR)) {
    console.log('No skills installed yet.');
    return;
  }
  
  const skills = fs.readdirSync(OPENCLAW_DIR).filter(f => {
    const skillPath = path.join(OPENCLAW_DIR, f);
    return fs.statSync(skillPath).isDirectory() && 
           fs.existsSync(path.join(skillPath, 'SKILL.md'));
  });
  
  if (skills.length === 0) {
    console.log('No skills installed yet.');
  } else {
    console.log('Installed skills:');
    skills.forEach(s => console.log(`  - ${s}`));
  }
}

async function listAvailable() {
  console.log('Fetching available skills...\n');
  
  const url = `https://api.github.com/repos/${SKILLS_REPO}/contents/skills?ref=${SKILLS_BRANCH}`;
  
  https.get(url, { headers: { 'User-Agent': 'skunk-cli' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const skills = JSON.parse(data);
        console.log('Available skills:');
        skills.filter(s => s.type === 'dir').forEach(s => {
          console.log(`  - ${s.name}`);
        });
        console.log('\nInstall with: skunk install <skill-name>');
      } catch (e) {
        console.error('Failed to fetch skills list');
      }
    });
  }).on('error', (e) => {
    console.error('Failed to fetch skills:', e.message);
  });
}

async function installSkill(name) {
  if (!name) {
    console.log('Usage: skunk install <skill-name>');
    console.log('Run "skunk available" to see available skills');
    return;
  }
  
  console.log(`Installing ${name}...`);
  
  // Create skills directory if it doesn't exist
  if (!fs.existsSync(OPENCLAW_DIR)) {
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
  }
  
  const skillDir = path.join(OPENCLAW_DIR, name);
  
  if (fs.existsSync(skillDir)) {
    console.log(`Skill ${name} is already installed. Remove it first with: skunk remove ${name}`);
    return;
  }
  
  // Fetch skill files from GitHub
  const files = ['SKILL.md', 'config.json', 'README.md'];
  fs.mkdirSync(skillDir, { recursive: true });
  
  let success = false;
  
  for (const file of files) {
    const url = `https://raw.githubusercontent.com/${SKILLS_REPO}/${SKILLS_BRANCH}/skills/${name}/${file}`;
    
    try {
      const content = await fetchFile(url);
      if (content) {
        fs.writeFileSync(path.join(skillDir, file), content);
        if (file === 'SKILL.md') success = true;
      }
    } catch (e) {
      // README might not exist, that's ok
    }
  }
  
  if (success) {
    console.log(`✓ Installed ${name} to ${skillDir}`);
  } else {
    fs.rmSync(skillDir, { recursive: true, force: true });
    console.log(`✗ Skill "${name}" not found. Run "skunk available" to see available skills.`);
  }
}

function removeSkill(name) {
  if (!name) {
    console.log('Usage: skunk remove <skill-name>');
    return;
  }
  
  const skillDir = path.join(OPENCLAW_DIR, name);
  
  if (!fs.existsSync(skillDir)) {
    console.log(`Skill ${name} is not installed.`);
    return;
  }
  
  fs.rmSync(skillDir, { recursive: true, force: true });
  console.log(`✓ Removed ${name}`);
}

function fetchFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'skunk-cli' } }, (res) => {
      if (res.statusCode === 404) {
        resolve(null);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
