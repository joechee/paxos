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
    /* Node module */
    var $nodeGUI = function (node) {
      if (!(node instanceof NetworkNode)) {
        GLOBAL.log("Error in creating node GUI");
      }
      var $newNodeGUI = $('<div>');
      $newNodeGUI.addClass('node-gui');

      var disconnect = function () {
        node.disconnect();
        $newNodeGUI.remove();
      };

      var $disconnectButton = $('<button>');
      $disconnectButton.click(disconnect).appendTo($newNodeGUI);
      $disconnectButton.text("Disconnect " + node.id);


      return $newNodeGUI;
    }




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
      var newNode = new NetworkNode();
      window['node' + nodeID] = newNode;
      newNode.connect(network);
      $nodeGUI(newNode).appendTo($bottomBar);
    }
    
    var $addNodeButton = $('<button>');
    
    $bottomBar.append($addNodeButton);
    $addNodeButton.text("Add Node");
    $addNodeButton.click(addNode);
    
    // Adding a specific node
    function addSpecificNode(defaultID) {
      window.GLOBAL.log("Creating a specific node...");
      nodeID++;
      var newNode = new NetworkNode(undefined, defaultID);
      window['node' + nodeID] = newNode;
      newNode.connect(network);
      $nodeGUI(newNode).appendTo($bottomBar);
    }

    function promptNodeName() {
      if ($('#promptModal').is(':not(visible)')) {
        launchModal("What do you wish to set as the node id?", function (id) {
          addSpecificNode(id);
        });        
      }
    }
    
    var $addSpecificNodeButton = $('<button>');
    
    $bottomBar.append($addSpecificNodeButton);
    $addSpecificNodeButton.text("Add Specific Node");
    $addSpecificNodeButton.click(promptNodeName);
    

    // PAXOS GUI Code
    function startPAXOS(value) {
      network.startPAXOS(value);
    }
    
    var $startPAXOSButton = $('<button>');
    $bottomBar.append($startPAXOSButton);
    $startPAXOSButton.text("Start PAXOS");
    $startPAXOSButton.click(function () {
      if ($('#promptModal').is(':not(visible)')) {
        launchModal("What command do you wish to send?", function (command) {
          if (network.numberOfNodes() > 0) {
            network.getLeader().startPAXOS(command); //TODO: Do not hardcode this value
          } else {
            GLOBAL.log("No leaders to start PAXOS!");
          }        
        });        
      }
    });

    function launchModal(msg, callback) {
      $('#promptModal .text').text(msg);
      $('#promptModal').modal('show');
      $('#promptModal .text-input').val('');
      $('#promptModal .text-input').focus();
      $('#promptModal .callback').unbind('click');
      $('#promptModal .callback').click(function () {
        $('#promptModal').modal('hide');
        var val = $('#promptModal .text-input').val();
        if (!val) {
          val = guid();
        }
        callback(val);
      });


    }
    
    
    
  })(window);


})(window);
