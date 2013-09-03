var delay = false;

var NetworkNode = function (parent) {
    var currentNode = this;
    this.id = Math.random(); //TODO: Insert GUID function
    this.parent = parent;
    this.message = function (node, message) {
        if (delay) {
            setTimeout(function () {
                sendMessage(node, message);
            }, 0);
        } else {
            sendMessage(node, message);
        }
    };
    
    this.receiveMessage = function (from, message) {
        //TODO: Write a layered dispatcher.
    
    }
    
    var sendMessage = function (node, message) {
        node.receiveMessage(currentNode, message);
    };
};

var Network = function () {
    var nodes = {};
    this.registerNode = function () {
	    var newNode = new NetworkNode(this);
		nodes[nodeId] = node;
	    return newNode;
	};
	
	this.removeNode = function (node) {
        delete node[node.id];
    };
	    
}


{
    registerNode: function () {
	    return new NetworkNode();
	},
	removeNode: function () {
	    
	},

};