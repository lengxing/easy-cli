const chalk = require('chalk');
const execa = require('execa'); // 一个child_process封装库
const EventEmitter = require('events');
const fs = require('fs-extra');
const { clearConsole } = require('./util/clearConsole');
const { logWithSpinner, stopSpinner } = require('./util/spinner');
const { log, warn } = require('./util/logger');
const { hasGit, hasProjectGit } = require('./util/env');
const fetchRemotePreset = require('./util/loadRemotePreset');
const templateGitRepo = require('./config/templateGitRepo');

module.exports = class Creator extends EventEmitter {
  constructor(name, context) {
    super();
    this.name = name;
    this.context = process.env.EASY_CLI_CONTEXT = context; // cwd
  }

  async create(cliOptions = {}) {
    const { name, context } = this;
    await clearConsole();
    logWithSpinner(`✨`, `Creating project in ${chalk.yellow(context)}.`);
    const tmpdir = await fetchRemotePreset(
      templateGitRepo[process.env.EASY_CLI_TEMPLATE_NAME]
    );
    // 拷贝到项目文件下
    try {
      fs.copySync(tmpdir, context);
    } catch (error) {
      return console.error(chalk.red.dim(`Error: ${error}`));
    }
    const shouldInitGit = this.shouldInitGit();
    if (shouldInitGit) {
      // 已经安装git
      logWithSpinner(`🗃`, `Initializing git repository...`);
      this.emit('creation', { event: 'git-init' });
      await this.run('git init');
    }
    stopSpinner();

    // commit init state
    let gitCommitFailed = false;
    if (shouldInitGit) {
      await this.run('git add -A');
      try {
        await this.run('git', ['commit', '-m', 'init']);
      } catch (error) {
        gitCommitFailed = true;
      }
    }

    stopSpinner();
    log();
    log(`🎉  Successfully created project ${chalk.yellow(name)}.`);
    log();
    this.emit('creation', { event: 'done' });
    if (gitCommitFailed) {
      // commit fail
      warn(
        `Skipped git commit due to missing username and email in git config.\n` +
          `You will need to perform the initial commit yourself.\n`
      );
    }
  }

  run(command, args) {
    if (!args) {
      [command, ...args] = command.split(/\s+/);
    }
    return execa(command, args, { cwd: this.context });
  }

  shouldInitGit() {
    if (!hasGit()) {
      return false;
    }
    return !hasProjectGit(this.context);
  }
};