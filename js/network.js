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

      
      /* Private variables */
      var maxProposal = 0;

      

      this.getMaxOpID = function () {
        var max = 0;
        for (var i in this.oplog) {
          (parseInt(i, 10) > parseInt(max)) ? (max = parseInt(i, 10)) : (max = parseInt(max, 10));
        }
        return max;
      };
      
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
            this.sync(network);

        } else {
            this.log("Connection to " + network.id + " failed.");
        }
      };

      this.sync = function (network) {
        // TODO: Simulate proper syncing. Current syncing is just stuff

        this.log("Syncing with currently connected nodes");
        var nodes = network.getNodes();
        var maxOplog = {};
        for (var i in nodes) {
          if (JSONTools.getDictionarySize(nodes[i].oplog) > JSONTools.getDictionarySize(maxOplog)) {
            maxOplog = nodes[i].oplog;
          }
        }
        this.oplog = JSONTools.clone(maxOplog);
        this.log("Sync complete");
      }
      
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
      
      var PAXOSState = 'notStarted';

      // Propose phase variables
      var acceptBallotReplies = {};

      // Acceptance phase variables
      var acceptValueReplies = {};
      var value = 0;
      var promisedValue = undefined;

      var currentOpID = undefined;
      this.oplog = {};
      
      this.startPAXOS = function (v) {
        value = v;
        if (!this.isLeader()) {
          this.log("Error: Trying to start PAXOS when it is not the leader");
        } else if (PAXOSState == 'preparePhase') {
          this.log("Error: Starting PAXOS twice is currently still not supported");
          return;
        } else {
          this.log("Starting PAXOS");
        }



        startPreparePhase.call(this);
        


      };

      var startPreparePhase = function () {

        var opID = parseInt(this.getMaxOpID(), 10) + 1;

        currentOpID = opID;
        
        maxProposal++; // Increase the max proposal seen
        acceptBallotReplies = {};

        PAXOSState = 'preparePhase';

        this.broadcast(this.network, {
          id: opID, 
          cmd: 'startPreparePhase',
          propose: maxProposal
        });

        // Accept your own ballot!
        acceptBallotReplies[this.id] = true;
        checkProposePhaseCompleted();
      };



      var startAcceptancePhase = function () {
        currentNode.log("Sending Acceptance Requests...");
        currentNode.broadcast(currentNode.network, {
          id: currentOpID,
          proposal: maxProposal,
          cmd: "requestAcceptance",
          value: value
        });


        // Accept your own value!
        
        acceptValueReplies[currentNode.id] = true;
        checkAcceptancePhaseCompleted();
      };
      
      
      this.processPrepare = function (from, message) {
        var proposeID = message['propose'];
        var opID = message['id'];
        var accept = function (node) {
          this.log("Accepting ballot from " + from.id);
          this.message(node, {
            id: opID,
            cmd: 'acceptBallot',
            proposal: proposeID
          });
          maxProposal = proposeID;
          currentOpID = message['id'];
        };
        
        var reject = function (node) {
          this.message(node, {
            cmd: 'rejectBallot',
            proposal: proposeID,
            maxProposal: maxProposal,
            value: promisedValue
          });
        };
        
        if (this.getLeader() == this) {
          this.log("I am the leader? Why is " + from.name +" proposing? I will REJECT your proposal");
          reject.call(this, from);
        } else if (proposeID < maxProposal) {  
          reject.call(this, from);
        } else { 
          accept.call(this, from);
        }
      };
      
      this.processAcceptanceRequest = function(from, request) {
        var proposalID = request['proposal'];
        var proposalValue = request['value'];
        var opID = request['id'];
        var accept = function (node) {
          this.log("Accepting command from " + from.id);
          this.message(node, {
            cmd: 'acceptValue',
            id: opID,
            proposal: proposalID,
            value: proposalValue
          });

          this.oplog[opID] = {
            id: opID,
            proposal: proposalID,
            value: proposalValue
          };

          currentOpID = undefined; //reset currentOpID so as to wait for new requests.
        };
        var reject = function (node) {
          this.message(node, {
            cmd: 'rejectValue',
            proposal: proposalID,
            value: proposalValue
          });
        };

        if (this.oplog[opID] && this.oplog[opID]['proposal'] === proposalID && this.oplog[opID]['value'] === proposalValue) {
          accept.call(this, from); // Accept if there was a previous operation
        } else if (this.getLeader() == this) {
          this.log("I am the leader? Why is " + from.name +" proposing? I will REJECT the proposal");
          reject.call(this, from);
        } else if (proposalID < maxProposal) {  
          reject.call(this, from);
        } else if (promisedValue && promisedValue != proposalValue) {
          reject.call(this, from);
        } else { // >= in this case equality is included because we want to re-accept the proposal if somehow the message was dropped
          accept.call(this, from);
        }
        
      };
      
      
      
      
      
      
      var dispatchMessage = function (from, message, to) {
        switch (message['cmd']) {
            case "heartbeat":
              to.processHeartbeat(from, message);
              break;
            case "startPreparePhase":
              if (to.getLeader() !== from) {
                // TODO: Add code that allows multiple leaders
                to.log("ERROR: PAXOS was started from someone who wasn't a leader");
              } else {
                currentNode.processPrepare(from, message);
              }
              break;
            case "acceptBallot":
               if (currentOpID !== message['id']) {
                currentNode.log("Received Ballot Acceptance for a stale Op ID!");
                return;
              } else if (PAXOSState != 'preparePhase') {
                currentNode.log("Received Proposal Acceptance when PAXOS not started!");
              } else {
                acceptBallotReplies[from.id] = true;
              }
              checkProposePhaseCompleted();
              break;
            case "rejectBallot":
              if (currentOpID !== message['id']) {
                currentNode.log("Received Ballot Rejection for a stale Op ID!");
                return;
              }
              acceptBallotReplies[from.id] = false;
              checkProposePhaseCompleted();
              break;
            case "requestAcceptance":
              var opID = message['id'];
              if (currentNode.oplog[opID]) {
                currentNode.log("Received Acceptance Request for an op that is already completed. Returning results.");
                currentNode.message(from, {
                  id: opID,
                  proposal: currentNode.oplog[opID]['proposal'],
                  value: currentNode.oplog[opID]['value']
                });
              } else if (currentOpID !== message['id']) {
                currentNode.log("Received Acceptance Request for an unknown Op ID!");
                return;
              }
              currentNode.processAcceptanceRequest(from, message);
              break;
            case "acceptValue":
              if (currentOpID === message['id']) {
                acceptValueReplies[from.id] = true;
                checkAcceptancePhaseCompleted();
              }
              break;
            case "rejectValue":
              if (currentOpID === message['id']) {
                acceptValueReplies[from.id] = false;
                checkAcceptancePhaseCompleted();
              }
              break;
        }
      };
      
      var checkProposePhaseCompleted = function () {
        var accepts = 0; // accepts should be positive after this function ends to ensure majority
        for (var i in visibleNodes) {
          if (acceptBallotReplies[i] === true) {
            accepts++;
          } else {
            accepts--;
          }
        }
        if (accepts > 0) { // Majority
          currentNode.log("Received Majority acceptance. Cleaning up and continuing to next phase");
          /* cleanup code */
          acceptBallotReplies = {};
          /* end cleanup code */
          startAcceptancePhase();

        }
        
        var rejects = 0;
        for (var i in visibleNodes) {
          if (acceptBallotReplies[i] === false) {
            rejects++;
          } else {
            rejects--;
          }
        }
        
        if (rejects > 0) {
          /* cleanup code */
          acceptBallotReplies = {};
          /* end cleanup code */
          PAXOSState = 'notStarted';
          currentNode.log("PAXOS attempt failed.");
          // TODO: Restart PAXOS?
        }
      };


      
      var checkAcceptancePhaseCompleted = function () {
        var accepts = 0; // accepts should be positive after this function ends to ensure majority
        for (var i in visibleNodes) {
          if (acceptValueReplies[i] === true) {
            accepts++;
          } else {
            accepts--;
          }
        }
        if (accepts > 0) { // Majority
          currentNode.log("Received Majority acceptance. Agreed on " + value);
          /* cleanup code */
          currentNode.oplog[currentOpID] = {
            id: currentOpID,
            proposal: maxProposal,
            value: value
          };
          value = undefined;
          currentOpID = undefined;
          PAXOSState = 'notStarted';
          acceptValueReplies = {};

          /* end cleanup code */
        }
        
        var rejects = 0;
        for (var i in visibleNodes) {
          if (acceptValueReplies[i] === false) {
            rejects++;
          } else {
            rejects--;
          }
        }
        
        if (rejects > 0) {
          /* cleanup code */
          acceptValueReplies = {};
          /* end cleanup code */
          PAXOSState = 'notStarted';
          currentNode.log("PAXOS attempt failed.");
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

