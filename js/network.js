var delay = true;


(function (window) {
  /* Various helper functions */ 
  var randomInteger = function (max) {
    return Math.floor(Math.random() * max);
  };
  
  
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  
  function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  }
  
  window.randomInteger = randomInteger;
  window.guid = guid;
})(window);

(function (window) {

  /* Settings */
  var inactivityTimeout = 2000;



  var log = function (msg) {
    var name = this.id || this.name || "Unknown-object";
    console.log("[" + name + "] " + msg);
  };

  var LoggableObject = function () {};
  LoggableObject.prototype.log = log;


  /* Proposal ID Object */
  var ProposalID = function (proposalID, nodeID) {
    this.getProposalID = function () {
      return proposalID;
    };
    this.getNodeID = function () {
      return nodeID;
    };
    this.greaterThan = function (proposalID) {
      if (proposalID instanceof ProposalID) {
        if (this.getProposalID() === proposalID.getProposalID()) {
          return this.getNodeID() > proposalID.getNodeID();
        } else {
          return this.getProposalID() > proposalID.getProposalID();
        }
      }
    };
  };
  

  var NetworkNode = function (network, defaultID) {
      var currentNode = this;
      var backgroundNetworkTasks = [];


    
      
      if (defaultID) {
        this.id = "node-" + defaultID;
      } else {
        this.id = "node-" + guid();
      }
      this.network = network;
      this.type = "node";
      this.message = function (node, message) {
        if (!node) {
          this.log("I'm messaging no one!");
          return;
        };
        if (delay) {
            setTimeout(function () {
                currentNode.network.channel.push({
                  from: currentNode,
                  message: message,
                  to: node
                });
            }, 1);
        }
      };
      
      this.receiveMessage = function (from, message) {
        dispatchMessage(from, message, currentNode);
      };
      
      this.connect = function (network) {
        this.log("Connecting to " + network.id);
        if (network.register(this)) {
            this.network = network;
            this.log("Successfully connected to " + network.id);

        } else {
            this.log("Connection to " + network.id + " failed.");
        }
      };
      
      this.broadcast = function (network, message) {
        if (network) {
          this.network.broadcast(this, message);
        }
      };
      
      var leader = undefined;
      
      this.processHeartbeat = function (from, message) {
        visibleNodes[from.id] = {
          node: from,
          lastSeen: new Date()
        };
      };
      
      this.disconnect = function () {
        if (!this.network) {
          this.log("Error: Not connected to any network!");
        } else {
          this.log("Disconnecting from " + this.network.id);
          this.network.removeNode(this);
          this.log("Successfully disconnected from "+ this.network.id);
          this.network = undefined;
          for (var i in backgroundNetworkTasks) {
            var task = backgroundNetworkTasks[i];
            clearInterval(task);
          }
        }
      };
      
      
      var broadcastHeartbeat = function () {
        currentNode.broadcast(currentNode.network, {
            cmd: "heartbeat"
        });
      };
      
      backgroundNetworkTasks.push(setInterval(broadcastHeartbeat, 200));
      
      var visibleNodes = {};
      visibleNodes[this.id] = {
        node: this
      };  
      
      var cleanUpNodes = function () {

        var now = new Date();
        for (var i in visibleNodes) {
          if (i === this.id) {
              continue;
          } else if (now - visibleNodes[i].lastSeen > inactivityTimeout) {
              currentNode.log(visibleNodes[i].node.id + " disconnected due to inactivity");
              delete visibleNodes[i];
          }
        }
      };
      
      this.getLeader = function () {
        var lowestId;
        for (var i in visibleNodes) {
          if (i == "log") continue;
          if (!lowestId) {
            lowestId = i;
          } else if (i < lowestId) {
            lowestId = i;
          }
        }
        
        return visibleNodes[lowestId].node;
      };
      
      this.isLeader = function () {
        return this.getLeader() === this;
      };
      
      
      
      /*
        PAXOS variables
      */

      var slot = 0;
      var ballot = 0;
      var value = 0;

      this.startPAXOS = function (value) {
        this.log("Starting from SCRATCH. Plz accept my ballot");
        this.broadcast(this.network, {
          slot: slot,
          ballot: ballot,
          type: "prepare" 
        });
      };
      
      
      
      
      
      
      var dispatchMessage = function (from, message, to) {
        switch (message['cmd']) {

        }
      };
      
      
      
      
      backgroundNetworkTasks.push(setInterval(cleanUpNodes, 1000));
      
      
      
      
  };

  var Network = function () {
      this.id = "network-" + guid();
      this.name = this.id;
      var currentNetwork = this;
      var nodes = {};
      
      this.channel = [];
      
      this.register = function (node) {
  		    nodes[node.id] = node;
          node.network = this;
  	      this.log("Successfully registered " + node.id);
          return true;
  	  };
  	
  	  this.removeNode = function (node) {
          delete nodes[node.id];
  	  };
      
      this.broadcast = function (from, message) {
          for (var i in nodes) {  
              if (from != nodes[i]) {
                  from.message(nodes[i], message);  
              } 
          }
      };
      
      this.getLeader = function () {
          // TODO: Take into account multiple leaders
          var leader;
          for (var i in nodes) {
              leader = nodes[i].getLeader();
          }
          return leader;
      };

      this.numberOfNodes = function () {
        var result = 0;
        for (var i in nodes) {
          result++;
        }
        return result;
      };

      this.getNodes = function () {
        return nodes;
      };
      
      setInterval(function () {
        for (var i in currentNetwork.channel) {
          
          var packet = currentNetwork.channel[i];
          packet['to'].receiveMessage(packet['from'], packet['message']);
        }
        currentNetwork.channel.length = 0;
      }, 100)
      
      
      
      
      
  };

  Network.prototype = new LoggableObject();
  NetworkNode.prototype = new LoggableObject();



  var GLOBAL = new LoggableObject();
  GLOBAL.name = "GLOBAL";
  window.Network = Network;
  window.NetworkNode = NetworkNode;
  window.LoggableObject = LoggableObject;
  window.GLOBAL = GLOBAL;
  
})(window);

