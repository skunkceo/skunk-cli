#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const SKILLS_REPO = 'skunkceo/openclaw-skills';
const SKILLS_BRANCH = 'main';
const OPENCLAW_DIR = path.join(process.env.HOME, '.openclaw', 'skills');

// Plugin registry - maps plugin names to slugs
// All downloads go through skunkglobal.com/api/plugin-updates/download
const PLUGIN_REGISTRY = {
  'skunkcrm': {
    slug: 'skunkcrm',
    proSlug: 'skunkcrm-pro',
    name: 'SkunkCRM',
  },
  'skunkforms': {
    slug: 'skunkforms',
    proSlug: 'skunkforms-pro',
    name: 'SkunkForms',
  },
  'skunkpages': {
    slug: 'skunkpages',
    proSlug: 'skunkpages-pro',
    name: 'SkunkPages',
  },
};

const DOWNLOAD_BASE = 'https://skunkglobal.com/api/plugin-updates/download';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }

// Parse arguments
const args = process.argv.slice(2);
const command = args[0] || 'help';

// Route commands
switch (command) {
  case 'install':
    handleInstall(args.slice(1));
    break;
  case 'remove':
    handleRemove(args.slice(1));
    break;
  case 'list':
    listSkills();
    break;
  case 'available':
    listAvailable();
    break;
  case 'plugins':
    listPlugins();
    break;
  case 'status':
    checkStatus();
    break;
  case 'update':
    handleUpdate();
    break;
  case 'setup':
    runSetup();
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    showHelp();
}

// ═══════════════════════════════════════════════════════════════════════════
// Install Handler
// ═══════════════════════════════════════════════════════════════════════════

async function handleInstall(args) {
  const type = args[0];
  const name = args[1];
  const extraArgs = args.slice(2);
  
  if (!type || !name) {
    console.log(`
Usage:
  skunk install skill <name>     Install an AI skill
  skunk install plugin <name>    Install a WordPress plugin

Examples:
  skunk install skill skunkforms
  skunk install plugin skunkforms
  skunk install plugin skunkcrm-pro --license=XXXX

Run "skunk available" for skills or "skunk plugins" for plugins.
`);
    return;
  }
  
  if (type === 'skill') {
    await installSkill(name);
  } else if (type === 'plugin') {
    await installPlugin(name, extraArgs);
  } else {
    // Backwards compat: treat as skill name
    console.log(`${colors.yellow}Hint: Use "skunk install skill ${type}" or "skunk install plugin ${type}"${colors.reset}\n`);
    await installSkill(type);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Remove Handler
// ═══════════════════════════════════════════════════════════════════════════

function handleRemove(args) {
  const type = args[0];
  const name = args[1];
  
  if (!type) {
    console.log('Usage: skunk remove skill <name>');
    return;
  }
  
  if (type === 'skill' && name) {
    removeSkill(name);
  } else {
    // Backwards compat
    removeSkill(type);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Skill Management
// ═══════════════════════════════════════════════════════════════════════════

async function installSkill(name) {
  if (!name) {
    console.log('Usage: skunk install skill <skill-name>');
    console.log('Run "skunk available" to see available skills');
    return;
  }
  
  console.log(`Installing skill: ${name}...`);
  
  if (!fs.existsSync(OPENCLAW_DIR)) {
    fs.mkdirSync(OPENCLAW_DIR, { recursive: true });
  }
  
  const skillDir = path.join(OPENCLAW_DIR, name);
  
  if (fs.existsSync(skillDir)) {
    console.log(`Skill ${name} is already installed. Remove it first with: skunk remove skill ${name}`);
    return;
  }
  
  const files = ['SKILL.md', 'config.json', 'README.md'];
  fs.mkdirSync(skillDir, { recursive: true });
  
  let installed = false;
  
  for (const file of files) {
    const url = `https://raw.githubusercontent.com/${SKILLS_REPO}/${SKILLS_BRANCH}/skills/${name}/${file}`;
    
    try {
      const content = await fetchFile(url);
      if (content) {
        fs.writeFileSync(path.join(skillDir, file), content);
        if (file === 'SKILL.md') installed = true;
      }
    } catch (e) {
      // Optional files may not exist
    }
  }
  
  if (installed) {
    success(`Installed skill "${name}" to ${skillDir}`);
    console.log(`\n${colors.dim}Restart your AI assistant to load the new skill.${colors.reset}`);
  } else {
    fs.rmSync(skillDir, { recursive: true, force: true });
    error(`Skill "${name}" not found. Run "skunk available" to see available skills.`);
  }
}

function removeSkill(name) {
  if (!name) {
    console.log('Usage: skunk remove skill <skill-name>');
    return;
  }
  
  const skillDir = path.join(OPENCLAW_DIR, name);
  
  if (!fs.existsSync(skillDir)) {
    console.log(`Skill ${name} is not installed.`);
    return;
  }
  
  fs.rmSync(skillDir, { recursive: true, force: true });
  success(`Removed skill "${name}"`);
}

function listSkills() {
  if (!fs.existsSync(OPENCLAW_DIR)) {
    console.log('No skills installed yet.');
    console.log('Run "skunk available" to see available skills.');
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
    console.log('Installed skills:\n');
    skills.forEach(s => console.log(`  ${colors.green}●${colors.reset} ${s}`));
    console.log(`\n${colors.dim}Skills location: ${OPENCLAW_DIR}${colors.reset}`);
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
        console.log('Available AI skills:\n');
        skills.filter(s => s.type === 'dir').forEach(s => {
          console.log(`  ${colors.cyan}●${colors.reset} ${s.name}`);
        });
        console.log(`\n${colors.dim}Install with: skunk install skill <name>${colors.reset}`);
      } catch (e) {
        error('Failed to fetch skills list');
      }
    });
  }).on('error', (e) => {
    error('Failed to fetch skills: ' + e.message);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Plugin Management
// ═══════════════════════════════════════════════════════════════════════════

async function installPlugin(name, extraArgs) {
  // Parse name for -pro suffix
  let pluginKey = name.replace(/-pro$/, '');
  let isPro = name.endsWith('-pro');
  
  const plugin = PLUGIN_REGISTRY[pluginKey];
  
  if (!plugin) {
    error(`Unknown plugin: ${name}`);
    console.log('\nAvailable plugins:');
    listPlugins();
    return;
  }
  
  // Parse license from args
  let license = null;
  for (const arg of extraArgs) {
    if (arg.startsWith('--license=')) {
      license = arg.split('=')[1];
    }
  }
  
  // Detect WP-CLI or WordPress Studio
  const hasWpCli = commandExists('wp');
  const hasStudio = commandExists('studio');
  
  if (!hasWpCli && !hasStudio) {
    error('No WordPress CLI found.');
    console.log(`
To install WordPress plugins, you need either:

  ${colors.cyan}WP-CLI${colors.reset} (for server/local installs)
    https://wp-cli.org/

  ${colors.cyan}WordPress Studio${colors.reset} (for local development)
    https://developer.wordpress.org/studio/
    macOS: brew install --cask wordpress-studio
`);
    return;
  }
  
  // Build download URL
  const slug = isPro ? plugin.proSlug : plugin.slug;
  let downloadUrl = `${DOWNLOAD_BASE}?slug=${slug}`;
  
  // Add license key for Pro versions
  if (isPro && license) {
    downloadUrl += `&license_key=${license}`;
  }
  
  const displayName = isPro ? `${plugin.name} Pro` : plugin.name;
  
  console.log(`Installing ${displayName}...`);
  
  // Pro requires license
  if (isPro && !license) {
    warn('Pro version requires a license key.');
    console.log(`  skunk install plugin ${name} --license=YOUR_LICENSE_KEY\n`);
    console.log(`${colors.dim}Get a license at: https://skunkglobal.com/pricing${colors.reset}`);
    return;
  }
  
  // Build the command
  let cmd;
  if (hasStudio) {
    cmd = `studio wp plugin install "${downloadUrl}" --activate`;
  } else {
    cmd = `wp plugin install "${downloadUrl}" --activate`;
  }
  
  console.log(`${colors.dim}Running: ${cmd}${colors.reset}\n`);
  
  try {
    execSync(cmd, { stdio: 'inherit' });
    success(`Installed ${displayName}`);
    
    // Suggest installing the skill too
    console.log(`\n${colors.dim}Tip: Install the AI skill to let your assistant manage ${plugin.name}:${colors.reset}`);
    console.log(`  skunk install skill ${pluginKey}\n`);
    
  } catch (e) {
    error(`Failed to install ${displayName}`);
    console.log(`\n${colors.dim}If using WordPress Studio, make sure you have a site selected.${colors.reset}`);
  }
}

function listPlugins() {
  console.log('Available WordPress plugins:\n');
  
  for (const [key, plugin] of Object.entries(PLUGIN_REGISTRY)) {
    console.log(`  ${colors.cyan}●${colors.reset} ${key}${colors.dim} (${plugin.name} Free)${colors.reset}`);
    console.log(`  ${colors.cyan}●${colors.reset} ${key}-pro${colors.dim} (${plugin.name} Pro)${colors.reset}`);
  }
  
  console.log(`
${colors.dim}Install with: skunk install plugin <name>
Pro versions: skunk install plugin <name>-pro --license=XXXX${colors.reset}
`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Status - Check plugin versions
// ═══════════════════════════════════════════════════════════════════════════

async function checkStatus() {
  console.log('Checking plugin versions...\n');
  
  // Fetch latest versions from API
  const versionsUrl = 'https://skunkglobal.com/api/plugins/versions';
  
  try {
    const latestVersions = await new Promise((resolve, reject) => {
      https.get(versionsUrl, { headers: { 'User-Agent': 'skunk-cli' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid response'));
          }
        });
      }).on('error', reject);
    });
    
    if (!latestVersions.plugins) {
      error('Failed to fetch version info');
      return;
    }
    
    // Check if we're in a WordPress context (wp or studio available)
    const hasWpCli = commandExists('wp');
    const hasStudio = commandExists('studio');
    const inWordPress = hasWpCli || hasStudio;
    
    // Get installed versions if in WordPress context
    let installedVersions = {};
    if (inWordPress) {
      try {
        const cmd = hasStudio ? 'studio wp plugin list --format=json' : 'wp plugin list --format=json';
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const plugins = JSON.parse(output);
        
        for (const p of plugins) {
          // Map WP plugin slugs to our slugs
          if (p.name === 'skunk-crm' || p.name === 'skunkcrm') {
            installedVersions['skunkcrm'] = p.version;
          } else if (p.name === 'skunk-forms' || p.name === 'skunkforms') {
            installedVersions['skunkforms'] = p.version;
          } else if (p.name === 'skunk-pages' || p.name === 'skunkpages') {
            installedVersions['skunkpages'] = p.version;
          }
        }
      } catch (e) {
        // Couldn't get installed versions, that's ok
      }
    }
    
    console.log(`${colors.bright}Plugin${colors.reset}            ${colors.bright}Latest${colors.reset}      ${inWordPress ? `${colors.bright}Installed${colors.reset}` : ''}`);
    console.log('─'.repeat(inWordPress ? 50 : 30));
    
    // Show free plugins
    for (const [slug, info] of Object.entries(latestVersions.plugins)) {
      if (info.type === 'free') {
        const installed = installedVersions[slug];
        const latestV = info.version;
        
        let status = '';
        if (installed) {
          if (installed === latestV) {
            status = `${colors.green}${installed}${colors.reset} ✓`;
          } else {
            status = `${colors.yellow}${installed}${colors.reset} → ${latestV}`;
          }
        } else if (inWordPress) {
          status = `${colors.dim}not installed${colors.reset}`;
        }
        
        const padding = ' '.repeat(Math.max(0, 16 - slug.length));
        const vPadding = ' '.repeat(Math.max(0, 10 - latestV.length));
        console.log(`${slug}${padding}${latestV}${vPadding}${status}`);
      }
    }
    
    console.log('');
    
    // Show if updates available
    const hasUpdates = Object.entries(installedVersions).some(([slug, v]) => {
      const latest = latestVersions.plugins[slug];
      return latest && latest.version !== v;
    });
    
    if (hasUpdates) {
      console.log(`${colors.yellow}Updates available!${colors.reset} Run:`);
      console.log(`  skunk install plugin <name>\n`);
    } else if (Object.keys(installedVersions).length > 0) {
      console.log(`${colors.green}All plugins up to date!${colors.reset}\n`);
    }
    
  } catch (e) {
    error('Failed to check versions: ' + e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Update
// ═══════════════════════════════════════════════════════════════════════════

function handleUpdate() {
  console.log('Updating Skunk CLI...\n');
  
  try {
    execSync('npm update -g @skunkceo/cli', { stdio: 'inherit' });
    success('Skunk CLI updated');
  } catch (e) {
    error('Failed to update CLI');
    console.log(`${colors.dim}Try: sudo npm update -g @skunkceo/cli${colors.reset}`);
    return;
  }
  
  // Refresh installed skills
  if (fs.existsSync(OPENCLAW_DIR)) {
    const skills = fs.readdirSync(OPENCLAW_DIR).filter(f => {
      const skillPath = path.join(OPENCLAW_DIR, f);
      return fs.statSync(skillPath).isDirectory();
    });
    
    if (skills.length > 0) {
      console.log('\nRefreshing installed skills...\n');
      
      for (const skill of skills) {
        const skillDir = path.join(OPENCLAW_DIR, skill);
        fs.rmSync(skillDir, { recursive: true, force: true });
        // Re-fetch (sync for simplicity in update flow)
        console.log(`  Updating ${skill}...`);
      }
      
      console.log(`\n${colors.dim}Run "skunk list" to verify skills.${colors.reset}`);
    }
  }
  
  console.log('\n' + success('Update complete'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Setup & Help
// ═══════════════════════════════════════════════════════════════════════════

function runSetup() {
  const setupPath = path.join(__dirname, 'setup.js');
  require(setupPath);
}

function showHelp() {
  console.log(`
${colors.bright}🦨 Skunk CLI${colors.reset} - AI-Powered WordPress Toolkit

${colors.bright}Usage:${colors.reset}
  skunk setup                       Interactive setup wizard
  skunk install skill <name>        Install an AI skill
  skunk install plugin <name>       Install a WordPress plugin
  skunk remove skill <name>         Remove an installed skill
  skunk list                        List installed skills
  skunk available                   List available skills
  skunk plugins                     List available plugins
  skunk status                      Check plugin versions (+ compare if in WP site)
  skunk update                      Update CLI and refresh skills
  skunk help                        Show this help

${colors.bright}Examples:${colors.reset}
  skunk setup                       # Full guided setup
  skunk install skill skunkforms    # Install SkunkForms AI skill
  skunk install plugin skunkforms   # Install SkunkForms WP plugin
  skunk install plugin skunkcrm-pro --license=XXXX

${colors.bright}Skills${colors.reset} teach your AI assistant how to use Skunk products.
${colors.bright}Plugins${colors.reset} are the actual WordPress plugins that run on your site.

${colors.dim}Docs: https://skunkglobal.com/guides/openclaw-wordpress${colors.reset}
`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}
