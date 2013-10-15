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


  /* Constants */
  var REASON = {
    PREVIOUS_SLOT_INCOMPLETE: 1
  };



  var log = function (msg) {
    var name = this.id || this.name || "Unknown-object";
    console.log("[" + name + "] " + msg);
  };

  var LoggableObject = function () {};
  LoggableObject.prototype.log = log;


  /* Proposal ID Object */
  var BallotID = function (ballotID, nodeID) {
    this.getBallotID = function () {
      return parseInt(ballotID, 10);
    };
    this.getNodeID = function () {
      return parseInt(nodeID, 10);
    };
    this.greaterThan = function (ballotID) {
      if (ballotID instanceof BallotID) {
        if (this.getBallotID() === ballotID.getBallotID()) {
          return this.getNodeID() > ballotID.getNodeID();
        } else {
          return this.getBallotID() > ballotID.getBallotID();
        }
      }
    };
  };
  

  var NetworkNode = function (network, defaultID) {
      var currentNode = this;
      var backgroundNetworkTasks = [];
      var visibleNodes = {};

      this.dispatcher = {
        'heartbeat': this.processHeartbeat
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
      
      var processHeartbeat = function (from, message) {
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
            type: "heartbeat"
        });
      };
      
      backgroundNetworkTasks.push(setInterval(broadcastHeartbeat, 200));
      
      
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


      this.getNodeNumber = function () {
        var nodeNumber = 0;
        for (var i in visibleNodes) {
          nodeNumber++;
        }
        return nodeNumber;
      };


      var dispatchMessage = function (from, message, to) {
        var type = message['type'];
        if (currentNode.dispatcher[type]) {
          return currentNode.dispatcher[type].call(currentNode, from, message);
        } else {
          throw new Error("Unable to dispatch type!");
        }
      };


      this.dispatcher['heartbeat'] = processHeartbeat;
      
      
      
      backgroundNetworkTasks.push(setInterval(cleanUpNodes, 1000));
  };


  var PAXOSNode = function (network, defaultID) {

    /*

    There are 3 phases in this algorithm:

    1. Prepare phase -- The leader prepares a ballot
    2. Accept phase -- The leader prepares the acceptance
    3. Acknowledge phase -- The leader tells everyone that a decision has been made

    */

    var currentNode = new NetworkNode(network, defaultID);
    /*
      PAXOS variables
    */

    // Variables for the leader
    var leader = {
      slot: 0,
      ballot: 0,
      value: 0
    };

    var PrimaryState = function () {
      var slots = {
        0: {
          slot: 0,
          ballot: -1,
          value: 1,
          state: "completed"
        }
      };
      this.getMaxSlotID = function () {
        var max = 0;
        for (var i in slots) {
          var slotID = parseInt(i, 10);
          (max < slotID && slots[i].phase === "completed") ? max = slotID : max = max;
        }
        return max;
      };

      this.getNewSlotState = function () {
        var slot = this.getMaxSlotID() + 1;
        slots[slot] = {
          slot: slot,
          ballot: 1,
          value: undefined,
          state: "notStarted"
        };
        return slots[slot];
      };

      this.getState = function (slot) {
        if (!slots[slot]) {
          // Check if the previous slot has completed
          return undefined;
        } else {
          return slots[slot];
        }
      }

    };

    var leader = new PrimaryState();

    // Variables for the secondaries


    var SecondaryState = function () {
      var slots = {
        0: {
          slot: 0,
          ballot: new BallotID(0, 0),
          value: 1,
          phase: "completed"
        }
      };
      this.getMaxSlotID = function () {
        var max = 0;
        for (var i in slots) {
          var slotID = parseInt(i, 10);
          (max < slotID && slots[i].phase === "completed") ? max = slotID : max = max;
        }
        return max;
      };
      this.getState = function (slot) {
        if (!slots[slot]) {
          // Check if the previous slot has completed

          if (this.getMaxSlotID() != slot - 1) {
            return undefined;
          } else if (slots[slot - 1].phase !== "completed") {
            return undefined;
          }

          slots[slot] = {
            slot: slot,
            ballot: new BallotID(0, 0),
            value: undefined,
            phase: "notStarted"
          };
        }
        return slots[slot];
      };

      this.setState = function (slot, state) {
        slots[slot] = state;
      };
    };
    var secondary = new SecondaryState();

    var firstTime = true;


    currentNode.startPAXOS = function (value) {
      var state = leader.getNewSlotState();   
      currentNode.log("Preparing ballot");

      state.ballot = new BallotID(currentNode.id, 1);
      state.value = value;

      if (firstTime) {      
        startPreparePhase(state);
      } else {
        firstTime = false;
        startAcceptancePhase(state);
      }
    };

    var startPreparePhase = function (state) {

      state.phase = "prepare";
      state.prepareReplies = {};
      state.acceptanceReplies = {};

      currentNode.broadcast(currentNode.network, {
        slot: state.slot,
        ballot: state.ballot,
        type: "prepareRequest" 
      });

      // Just tell myself that I am preparing ballot as well
      currentNode.message(currentNode, {
        slot: state.slot,
        ballot: state.ballot,
        type: "prepareRequest" 
      });
    };


    var handlePrepareMessage = function(from, message) {
      var slot = message.slot;
      var currentState = secondary.getState(slot);

      if (!currentState) {
        currentNode.message(from, {
          'type': 'prepareReply',
          'slot': slot,
          'decision': 'reject',
          'maxBallot': undefined,
          'reason': REASON.PREVIOUS_SLOT_INCOMPLETE
        });
        return;
      } else if (currentState.phase === "completed") {
        // TODO: Dude this is completed! You should sync with me
        currentNode.message(from, {
          'type': 'completedReply',
          'slot': slot,
          'value': currentState.value,
          'ballot': currentState.ballot
        });
      } else if (currentState.ballot.greaterThan(message.ballot)) {
        currentNode.message(from, {
          'type': 'prepareReply',
          'slot': currentState.slot,
          'decision': 'reject',
          'maxBallot': currentState.ballot
        });
      } else {
        currentState.ballot = message.ballot;
        currentNode.message(from, {
          'slot': currentState.slot,
          'type': 'prepareReply',
          'decision': 'accept'
        });
      }
      
      currentNode.log("Received prepare message!");
    };

    var handlePrepareReplyMessage = function(from, message) {
      var state = leader.getState(message.slot);
      if (!state) {
        currentNode.log("Received a reply for a slot that does not exist!");
      } else if (state.phase !== "prepare") {
        currentNode.log("Received a reply when the phase is not the prepare phase anymore!");
        // TODO: Update the state of the node
      } else {
        if (!state.prepareReplies) {
          state.prepareReplies = {};
        }  
        if (message.decision == "reject" && message.reason === REASON.PREVIOUS_SLOT_INCOMPLETE) {
          // TODO: Sync previous slots
        } else if (message.decision == "reject") {
          // TODO: Restart with a higher ballot id
          var maxBallotID = Math.max(state.ballot.getBallotID(), message.ballot.getBallotID() + 1);
          state.ballot = new BallotID(currentNode.id, maxBallotID);
          state.prepareReplies[from.id] = false;
          checkPrepareReplies(state);          
        } else {
          state.prepareReplies[from.id] = true;
          checkPrepareReplies(state);
        }
      }
    };

    var checkPrepareReplies = function (state) {
      var numberOfNodes = currentNode.getNodeNumber();

      // Check acceptance
      var accepts = -numberOfNodes / 2;
      for (var i in state.prepareReplies) {
        if (state.prepareReplies[i] === true) {
          accepts++;
        }
      }

      if (accepts > 0) {
        currentNode.log("Received majority votes. Moving on to accept phase");
        // Start Acceptance Phase

        startAcceptancePhase(state);

        return;
      }
      // Check rejection. If there is certain rejection, restart PAXOS
      var rejects = -numberOfNodes / 2;
      for (var i in state.prepareReplies) {
        if (state.prepareReplies[i] === true) {
          rejects++;
        }
      }
      if (rejects > 0) {
        startPreparePhase(state);
      }
    };

    var startAcceptancePhase = function (state) {
      state.phase = "acceptance";
      state.acceptanceReplies = {};
      currentNode.broadcast(currentNode.network, {
        slot: state.slot,
        ballot: state.ballot,
        value: state.value,
        type: "acceptanceRequest" 
      });

      currentNode.message(currentNode, {
        slot: state.slot,
        ballot: state.ballot,
        value: state.value,
        type: "acceptanceRequest" 
      });
    };

    var handleAcceptanceRequestMessage = function (from, message) {
      var currentState = secondary.getState(message.slot);
      if (!currentState) {
        currentNode.log("Received an acceptance request for a slot that does not exist!");
      } else if (currentState.phase === "completed") {
        // TODO: Dude this is completed! You should sync with me
      } else {
        if (message.value === undefined) {
          throw new Error("An undefined message was sent!");
        } else if (currentState.value !== undefined && currentState.value !== message.value 
                  || currentState.ballot.greaterThan(message.ballot)) {
          currentNode.message(from, {
            'type': 'acceptanceReply',
            'slot': currentState.slot,
            'decision': 'reject',
            'maxBallot': currentState.ballot,
            'value': currentState.value
          });
        } else {
          currentState.value = message.value;
          currentNode.message(from, {
            'type': 'acceptanceReply',
            'slot': currentState.slot,
            'decision': 'accept',
            'maxBallot': currentState.ballot,
            'value': currentState.value
          });
        }
      }
    };

    var handleAcceptanceReplyMessage = function (from, message) {
      var currentState = leader.getState(message.slot);
      if (!currentState) {
        currentNode.log("Received a acceptance request for a slot that does not exist!");
      } else if (currentState.phase === "completed") {
        // TODO: Dude this is completed! You should sync with me
      } else {
        if (message.value === undefined) {
          throw new Error("An undefined message was sent!");
        } else {
          currentNode.log("Received " + message.decision + " from " + from.id); 
          if (message.decision == "reject" && message.reason === REASON.PREVIOUS_SLOT_INCOMPLETE) {
            // TODO: Sync previous slots
            checkAcceptanceReplies(currentState);
          } else if (message.decision == "reject") {
            // TODO: Restart with a higher ballot id
            var maxBallotID = Math.max(currentState.ballot.getBallotID(), message.ballot.getBallotID() + 1);
            currentState.ballot = new BallotID(currentNode.id, maxBallotID);
            currentState.acceptanceReplies[from.id] = message.value;
            checkAcceptanceReplies(currentState); 
          } else {
            currentState.acceptanceReplies[from.id] = true;
            checkAcceptanceReplies(currentState);
          }
        }         
      }
    };


    var checkAcceptanceReplies = function (state) {
      var numberOfNodes = currentNode.getNodeNumber();

      // Check acceptance
      var accepts = -numberOfNodes / 2;
      for (var i in state.acceptanceReplies) {
        if (state.acceptanceReplies[i] === true) {
          accepts++;
        }
      }

      if (accepts > 0) {
        currentNode.log("Received majority votes. Moving on to Acknowledge phase");
        startAcknowledgePhase(state);
        return;
      }
      // Check rejection. If there is certain rejection, restart PAXOS
      var rejects = -numberOfNodes / 2;
      var values = {};
      for (var i in state.acceptanceReplies) {
        if (state.acceptanceReplies[i] !== true) {
          rejects++;

          // Record the most common value
          var value = state.acceptanceReplies[i];
          if (!values[value]) {
            values[value] = 1;
          } else {
            values[value]++;
          }
        }
      }
      if (rejects > 0) {
        // Restart PAXOS
        // If a value is already the majority, take it!
        for (var value in values) {
          if (values[value] > numberOfNodes / 2) {
            state.value = value;
          }
        }
        startPreparePhase(state);
      }
    };


    var startAcknowledgePhase = function (state) {
      firstTime = false;
      state.phase = "completed";
      state.acceptanceReplies = {};
      currentNode.broadcast(currentNode.network, {
        slot: state.slot,
        ballot: state.ballot,
        value: state.value,
        type: "decision" 
      });

      currentNode.message(currentNode, {
        slot: state.slot,
        ballot: state.ballot,
        value: state.value,
        type: "decision" 
      });
    };


    var handleDecisionMessage = function (from, message) {
      currentNode.log("Agreed on " + message.value);
      var currentState = secondary.getState(message.slot);
      if (!currentState) {
        currentState = {};
        secondary.setState(message.slot, currentState);
      }
      currentState.phase = "completed";
      currentState.ballot = message.ballot;
      currentState.value = message.value;
    };


    var handleCompletedReplyMessage = function (from, message) {
      var currentState = leader.getState(message.slot);
      if (!currentState) {
        currentState = {};
        leader.setState(message.slot, currentState);
      } 

      currentState.ballot = message.ballot;
      currentState.value = message.value;
      currentState.slot = message.slot;
      currentState.phase = "completed";
      currentNode.log("Slot " + currentState.slot + " has already been completed!");
    };


    // TODO: abstract the dispatchers to check if slots of completed
    //       if so, sync them.
    // Register the new handlers
    currentNode.dispatcher['prepareRequest'] = handlePrepareMessage;
    currentNode.dispatcher['acceptanceRequest'] = handleAcceptanceRequestMessage;
    currentNode.dispatcher['decision'] = handleDecisionMessage;

    // Register the primary handlers
    currentNode.dispatcher['prepareReply'] = handlePrepareReplyMessage;
    currentNode.dispatcher['acceptanceReply'] = handleAcceptanceReplyMessage;
    currentNode.dispatcher['completedReply'] = handleCompletedReplyMessage;

    return currentNode;
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
  window.PAXOSNode = PAXOSNode;
  window.NetworkNode = NetworkNode;

  window.LoggableObject = LoggableObject;
  window.GLOBAL = GLOBAL;
  
})(window);

