'use babel';

export default class AutoImportJsView {

  constructor(serializedState) {
    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('auto-import-js');

    // Create message element
    const message = document.createElement('div');
    message.textContent = 'Auto Importer (Press esc to exit.)';
    message.classList.add('message');
    this.element.appendChild(message);

    this.importList = document.createElement('ul');
    this.importList.classList.add('import-list');
    this.element.appendChild(this.importList);
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {}

  // Tear down any state and detach
  destroy() {
    this.element.remove();
  }

  setProposals(allProposals, onClickProposal) {
    console.log('allProposals', allProposals);
    while (this.importList.firstChild) {
      this.importList.removeChild(this.importList.firstChild);
    }
    allProposals.forEach((proposal) => {
      const proposalContainer = document.createElement('li');
      const link = document.createElement('a');
      const code = document.createElement('code');
      const useText = document.createElement('span');
      useText.textContent = 'Use: ';
      proposalContainer.classList.add('import-list-item');
      link.classList.add('import-list-a');
      link.onclick = function() {
        console.log('calling the on click');
        onClickProposal(proposal);
      };
      code.textContent = ` ${proposal.title} `;
      link.appendChild(useText);
      link.appendChild(code);
      proposalContainer.appendChild(link);
      this.importList.appendChild(proposalContainer);
    });
  }

  getElement() {
    return this.element;
  }

}
