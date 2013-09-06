/* 
GUI Module
----------

Renders network logs to screen.

Dependencies:
- jQuery 1.10.2
- network.js

*/
(function (window) {

  (function loggingModule(window) {
    var $logArea = $('<textarea>');
    $('body').append($logArea);
    
    LoggableObject.prototype.log = function (msg) {
      var name = this.id || this.name || "Unknown-object";
      var name = this.id || this.name || "Unknown-object";
      $logArea.append(document.createTextNode("[" + name + "] "+ msg + "\n"));
    };
    
  })(window);
  
  
  (function bottombarModule(window) {
    var $bottomBar = $('<div>');
    $bottomBar.addClass('bottom-bar');
    $('body').append($bottomBar);
    
    // TODO: Add buttons to bottombar
    
    function start() {
      window.GLOBAL.log("Starting up network...");
      window.network = new Network();
    }
    start();
    
    var nodeID = 0;
    
    function addNode() {
      window.GLOBAL.log("Creating a node...");
      nodeID++;
      window['node' + nodeID] = new NetworkNode();
      window.GLOBAL.log("Connecting it to a network");
      window['node' + nodeID].connect(network);
    }
    
    var $addNodeButton = $('<button>');
    
    $bottomBar.append($addNodeButton);
    $addNodeButton.text("Add Node");
    $addNodeButton.click(addNode);
    
    
    function startPAXOS(value) {
      network.startPAXOS(value);
    }
    
    var $startPAXOSButton = $('<button>');
    $bottomBar.append($startPAXOSButton);
    $startPAXOSButton.text("Start PAXOS");
    $startPAXOSButton.click(function () {
      if (nodeID > 0) {
        network.getLeader().startPAXOS(3); //TODO: Do not hardcode this value
      } else {
        GLOBAL.log("No leaders to start PAXOS!");
      }
    });
    
    
    
  })(window);


})(window);