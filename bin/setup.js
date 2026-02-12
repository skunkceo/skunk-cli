#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════════════════════
// ASCII Art
// ═══════════════════════════════════════════════════════════════════════════

const SKUNK_LOGO = `
   ███████╗██╗  ██╗██╗   ██╗███╗   ██╗██╗  ██╗
   ██╔════╝██║ ██╔╝██║   ██║████╗  ██║██║ ██╔╝
   ███████╗█████╔╝ ██║   ██║██╔██╗ ██║█████╔╝ 
   ╚════██║██╔═██╗ ██║   ██║██║╚██╗██║██╔═██╗ 
   ███████║██║  ██╗╚██████╔╝██║ ╚████║██║  ██╗
   ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
                    GLOBAL
`;

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function log(msg = '') {
  console.log(msg);
}

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}!${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function step(num, total, msg) {
  console.log(`\n${colors.cyan}[${num}/${total}]${colors.reset} ${colors.bright}${msg}${colors.reset}`);
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd) {
  try {
    return execSync(`${cmd} --version`, { encoding: 'utf8' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════════════

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  const answer = await ask(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

// ═══════════════════════════════════════════════════════════════════════════
// Skill Installation
// ═══════════════════════════════════════════════════════════════════════════

async function installSkill(skillName) {
  const skillsDir = path.join(process.env.HOME, '.openclaw', 'skills');
  const skillDir = path.join(skillsDir, skillName);

  if (fs.existsSync(skillDir)) {
    return { status: 'exists' };
  }

  // Fetch from GitHub
  const files = ['SKILL.md', 'config.json'];
  fs.mkdirSync(skillDir, { recursive: true });

  for (const file of files) {
    const url = `https://raw.githubusercontent.com/skunkceo/openclaw-skills/main/skills/${skillName}/${file}`;
    try {
      const content = await fetchFile(url);
      if (content) {
        fs.writeFileSync(path.join(skillDir, file), content);
      }
    } catch (e) {
      // Optional files may not exist
    }
  }

  if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
    return { status: 'installed' };
  } else {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { status: 'failed' };
  }
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
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Setup Flow
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.clear();
  
  // Show splash
  log(colors.bright + SKUNK_LOGO + colors.reset);
  log('');
  log(`${colors.dim}Welcome! Let's get your AI-powered WordPress toolkit ready.${colors.reset}`);
  log('');

  const totalSteps = 3;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Environment checks
  // ─────────────────────────────────────────────────────────────────────────
  step(1, totalSteps, 'Checking environment...');
  
  // Node.js
  const nodeVersion = getVersion('node');
  if (nodeVersion) {
    success(`Node.js ${nodeVersion}`);
  } else {
    error('Node.js not found');
    log('\n   Install Node.js: https://nodejs.org/');
    process.exit(1);
  }

  // WordPress Studio
  let studioExists = commandExists('studio');
  
  if (studioExists) {
    const studioVersion = getVersion('studio');
    success(`WordPress Studio installed ${studioVersion ? `(${studioVersion})` : ''}`);
  } else {
    warn('WordPress Studio not found');
    log('');
    log('   WordPress Studio is needed to create and manage WordPress sites.');
    log('');
    log('   Install it from: https://developer.wordpress.org/studio/');
    log('');
    log('   macOS:  brew install --cask wordpress-studio');
    log('   Other:  Download from the website');
    log('');
    
    const proceed = await confirm('Continue setup anyway?', true);
    if (!proceed) {
      log('\n   Run `skunk setup` again after installing WordPress Studio.');
      rl.close();
      process.exit(0);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: Install AI Skills
  // ─────────────────────────────────────────────────────────────────────────
  step(2, totalSteps, 'Installing AI skills...');
  log('');
  log(`   ${colors.dim}Skills teach your AI assistant how to work with WordPress${colors.reset}`);
  log(`   ${colors.dim}and Skunk products. Installing the essentials...${colors.reset}`);
  log('');

  // Core skills that enable WordPress + Skunk workflow
  const coreSkills = [
    { name: 'wordpress-studio', desc: 'WordPress site management' },
    { name: 'woocommerce', desc: 'WooCommerce store operations' },
    { name: 'skunkcrm', desc: 'SkunkCRM contact & pipeline management' },
    { name: 'skunkforms', desc: 'SkunkForms form building' },
    { name: 'skunkpages', desc: 'SkunkPages landing page optimization' },
  ];
  
  for (const skill of coreSkills) {
    process.stdout.write(`   ${skill.name} `);
    const result = await installSkill(skill.name);
    if (result.status === 'installed') {
      log(`${colors.green}✓${colors.reset} ${colors.dim}${skill.desc}${colors.reset}`);
    } else if (result.status === 'exists') {
      log(`${colors.dim}✓ already installed${colors.reset}`);
    } else {
      log(`${colors.yellow}! not available yet${colors.reset}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Done!
  // ─────────────────────────────────────────────────────────────────────────
  step(3, totalSteps, 'Ready!');
  log('');
  log(`   ${colors.green}Your AI assistant now knows WordPress and Skunk!${colors.reset}`);
  log('');
  log('   Next steps:');
  log('');
  
  if (studioExists) {
    log('   1. Create a WordPress site:');
    log(`      ${colors.cyan}studio create my-site${colors.reset}`);
    log('');
    log('   2. Start chatting with your AI:');
    log(`      ${colors.cyan}"Install WooCommerce"${colors.reset}`);
    log(`      ${colors.cyan}"Install SkunkCRM"${colors.reset}`);
    log(`      ${colors.cyan}"Create a contact form"${colors.reset}`);
  } else {
    log('   1. Install WordPress Studio');
    log('   2. Create a site: studio create my-site');
    log('   3. Chat with your AI to set up plugins');
  }
  
  log('');
  log(`   ${colors.dim}Guide: https://skunkglobal.com/guides/openclaw-wordpress${colors.reset}`);
  log('');

  rl.close();
}

// Run
main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
