'use babel';

import AutoImportJsView from './auto-import-js-view';
import { CompositeDisposable } from 'atom';

export default {

  autoImportJsView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.autoImportJsView = new AutoImportJsView(state.autoImportJsViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.autoImportJsView.getElement(),
      visible: false
    });

    this._onClickProposal = this._onClickProposal.bind(this);
    this._onEditorKeyUp = this._onEditorKeyUp.bind(this);

    this.view = atom.views.getView(atom.workspace.getActiveTextEditor());
    this.view.addEventListener('keyup', this._onEditorKeyUp);

    this.selection = '';

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'auto-import-js:toggle': () => this.toggle(),
      'auto-import-js:import': () => this.import(),
    }));
  },

  deactivate() {
    if (this.view) {
      this.view.removeEventListener('keyup', this._onEditorKeyUp);
    }
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.autoImportJsView.destroy();
  },

  serialize() {
    return {
      autoImportJsViewState: this.autoImportJsView.serialize()
    };
  },

  toggle(allProposal) {
    if (!this.modalPanel.isVisible()) {
      console.log('all proposals', allProposal);
      this.autoImportJsView.setProposals(allProposal, this._onClickProposal);
      return this.modalPanel.show();
    } else {
      return this.modalPanel.hide();
    }
  },
  import() {
    if (this.modalPanel.isVisible()) {
      this.modalPanel.hide();
      return;
    }
    editor = atom.workspace.getActiveTextEditor();
    const cursor = editor.cursors.length > 0 ? editor.cursors[0] : null;
    if (!cursor) {
      return;
    }
    this.selection = editor.getSelectedText();
    if (this.selection.length === 0) {
      const buffRange = cursor.getCurrentWordBufferRange();
      this.selection = editor.getTextInBufferRange(buffRange);
    }
    const directories = atom.project.getDirectories();
    let files = [];
    directories.forEach((directory) => {
      files = files.concat(this._traverseDirectory(directory));
    });
    console.log('slection =', this.selection);
    let proposals = [];
    let doneCount = 0;
    files.forEach((file) => {
      if (file.path.toLowerCase().endsWith(`/${this.selection.toLowerCase()}.js`)) {
        proposals.push({
          type: 'default',
          file,
        });
        doneCount += 1;
        return;
      }
      const dataStream = file.createReadStream();
      dataStream.on('data', (content) => {
        if (content.match(`export function ${this.selection}[\\(|\\s]`) !== null ||
            content.match(`export [const|let|var] ${this.selection}[;|\s]`) !== null) {
              proposals.push({
                type: 'property',
                file,
              });
        } else if (content.match(`export default ${this.selection}(\\{|\\s|\\(|;)`) !== null) {
          proposals.push({
            type: 'default',
            file,
          });
        }
      });
      dataStream.on('end', () => {
        doneCount += 1;
        console.log('doneCount', doneCount, files.length);
        if (doneCount >= files.length) {
          console.log('end');
          const allProposal = proposals.map((o) => {
            const { file, type } = o;
            const relativePath = this._getRelativePath(file.path, editor.getPath());
            const title = this._getImportString(type, relativePath);
            return {
              title,
              path: relativePath,
            };
          });
          console.log('allprops', allProposal, doneCount);
          if (allProposal.length > 0) {
            this.toggle(allProposal);
          } else {
            atom.notifications.addInfo('No Sources Found', {
              description: `Could not find any matches for '${this.selection}'`,
              dismissable: true,
              buttons: [{
                text: 'Dismiss',
                onDidClick: function() {
                  atom.notifications.getNotifications().forEach((n) => {
                    if (n.message === 'No Sources Found') {
                      n.dismiss();
                    }
                  });
                },
              }],
            });
          }
        }
      });
    });
    return null;
  },
  _getImportString(type, relativePath) {
    switch (type) {
      case 'default':
        return `import ${this.selection} from '${relativePath}';`
      case 'property':
        return `import { ${this.selection} } from '${relativePath}';`
      default:
        throw new Error(`Dont know how to deal with ${type}`);
    }
  },
  _getRelativePath(toPath, fromPath) {
    let currentPath = fromPath.substr(0, fromPath.lastIndexOf('/'));
    let upDirectory = [];
    while (currentPath.length > 0) {
      if (toPath.startsWith(currentPath)) {
        upDirectory.push(toPath.substr(currentPath.length+1));
        break;
      } else {
        currentPath = currentPath.substr(0, currentPath.lastIndexOf('/'));
        upDirectory.push('..');
      }
    }
    let resultDirectory = upDirectory.join('/');
    return resultDirectory.startsWith('.') ? resultDirectory : `./${resultDirectory}`;
  },
  _onEditorKeyUp(e) {
    if (e.keyCode === 27 && this.modalPanel.isVisible()) {
      this.modalPanel.hide();
    }
  },
  _onClickProposal(proposal) {
    console.log('clicked the proposal', proposal);
    editor = atom.workspace.getActiveTextEditor();
    let inComment = false;
    let foundImports = false;
    for (var i = 0; i < editor.getLineCount(); i++) {
      const line = editor.lineTextForBufferRow(i);
      if (line.indexOf('/*') >= 0) {
        inComment = true;
        continue;
      }
      if (inComment && line.indexOf ('*/') >= 0) {
        inComment = false;
        continue;
      }
      if (line.indexOf('import') >= 0) {
        foundImports = true;
        continue;
      }
      if (foundImports &&
          !inComment &&
          !line.indexOf('import') >= 0 &&
          line === '') {
        const range = [[i, i], [i, i]];
        editor.setTextInBufferRange(range, `${proposal.title}\n`);
        break;
      }
    }
    this.modalPanel.hide();
  },
  _traverseDirectory(directory) {
    let returnedFiles = [];
    const entries = directory.getEntriesSync();

    entries.forEach((entry) => {
      if (entry.isDirectory() && !entry.path.endsWith('node_modules')) {
        returnedFiles = returnedFiles.concat(this._traverseDirectory(entry));
      } else if (entry.isFile() && entry.path.endsWith('.js')) {
        returnedFiles.push(entry);
      }
    });
    return returnedFiles;
  }

};
