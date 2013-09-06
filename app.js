var delay = true;


(function (window) {
  /* Various helper functions */ 
  var randomInteger = function (max) {
    return Math.floor(Math.random() * max);
  };
  
  window.randomInteger = randomInteger;
})(window);

var log = function (msg) {
  var name = this.id || this.name || "Unknown-object";
  console.log("[" + name + "] " + msg);
};

var LoggableObject = function () {};
LoggableObject.prototype.log = log;

var NetworkNode = function (network) {
    var currentNode = this;
    
    /* Private variables */
    var maxProposal = 0;

    

    this.getMaxOpID = function () {
      var max = 0;
      for (var i in this.oplog) {
        (i > max) ? max = i : max = max;
      }
      return max;
    };
    
    
    
    
    this.id = "node" + Math.random(); //TODO: Insert GUID function
    this.network = network;
    this.type = "node";
    this.message = function (node, message) {
      // TODO: Implement FIFO Channel
      if (!node) {
        this.log("I'm messaging no one!");
        return;
      };
      if (delay) {
          setTimeout(function () {
              sendMessage(node, message);
          }, 1);
      } else {
          sendMessage(node, message);
      }
    };
    
    this.receiveMessage = function (from, message) {
      dispatchMessage(from, message, currentNode);
    }
    
    var sendMessage = function (node, message) {
      node.receiveMessage(currentNode, message);
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
      if (this.network) {
        network.removeNode(this);
        this.log("Successfully disconnected from "+ network);
      }
    };
    
    
    var broadcastHeartbeat = function () {
      currentNode.broadcast(currentNode.network, {
          cmd: "heartbeat"
      });
    };
    
    setInterval(broadcastHeartbeat, 1000);
    
    var visibleNodes = {};
    visibleNodes[this.id] = {
      node: this
    };  
    
    var cleanUpNodes = function () {
      var now = new Date();
      for (var i in visibleNodes) {
        if (i == "log" || i == this.id) {
            continue;
        } else if (now - visibleNodes[i].lastSeen > 5000) {
            this.log(visibleNodes[i].node.id + " disconnected due to inactivity");
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
    }
    
    
    
    /*
      PAXOS variables
    */
    
    var PAXOSState = 'notStarted';
    var acceptBallotReplies = {};
    var acceptValueReplies = {};
    var value = 0;
    var promisedValue = undefined;

    var currentOpID = undefined;
    this.oplog = {};
    
    this.startPAXOS = function (v) {
      value = value || v;
      if (!this.isLeader()) {
        this.log("Error: Trying to start PAXOS when it is not the leader");
      } else if (PAXOSState == 'preparePhase') {
        this.log("Error: Starting PAXOS twice is currently still not supported");
        return;
      } else {
        this.log("Starting PAXOS");
      }

      var opID = this.getMaxOpID() + 1;

      currentOpID = opID;
      
      maxProposal++; // Increase the max proposal seen
      acceptBallotReplies = {};
      
      this.broadcast(this.network, {
        id: opID, 
        cmd: 'startPAXOS',
        propose: maxProposal
      });
      PAXOSState = 'preparePhase';
    };
    
    this.processPrepare = function (from, message) {
      var proposeID = message['propose'];
      var opID = message['id'];
      var accept = function (node) {
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
          proposal: proposeId,
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
        this.message(node, {
          cmd: 'acceptValue',
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
          case "startPAXOS":
            if (to.getLeader() !== from) {
              // TODO: Add code that allows multiple leaders
              from.log("ERROR: PAXOS was started from someone who wasn't a leader");
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
            acceptValueReplies[from.id] = true;
            checkAcceptancePhaseCompleted();
            break;
          case "rejectValue":
            acceptValueReplies[from.id] = false;
            checkAcceptancePhaseCompleted();
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
        currentNode.log("Received Majority acceptance. Cleaning up Continuing to next phase");
        /* cleanup code */
        acceptBallotReplies = {};
        /* end cleanup code */
        currentNode.log("Sending Acceptance Requests...");
        currentNode.broadcast(currentNode.network, {
          id: currentOpID,
          proposal: maxProposal,
          cmd: "requestAcceptance",
          value: value
        });
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
    
    
    
    
    setInterval(cleanUpNodes, 1000);
    
    
    
    
};

var Network = function () {
    this.id = "network-" + Math.random();
    this.name = this.id;
    var nodes = {};
    this.register = function (node) {
		    nodes[node.id] = node;
        node.network = this;
	      this.log("Successfully registered " + node.id);
        return true;
	  };
	
	  this.removeNode = function (node) {
        delete node[node.id];
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
    
    
    
    
    
};

Network.prototype = new LoggableObject();
NetworkNode.prototype = new LoggableObject();



var GLOBAL = new LoggableObject();
GLOBAL.name = "GLOBAL";

(function start() {
    
    GLOBAL.log("Starting up network...");
    network = new Network();
    GLOBAL.log("Creating 3 nodes...");
    node1 = new NetworkNode();
    node2 = new NetworkNode();
    node3 = new NetworkNode();
    GLOBAL.log("Connecting them to a network");
    node1.connect(network);
    node2.connect(network);
    node3.connect(network);
    
    
})();



