/* Tools to manipulate JSON dictionaries */

(function (window) {

	var JSONTools = {};
    function getDictionarySize(dict) {
      var count = 0;
      for (var i in dict) {
        count++;
      }
      return count;
    }

    function clone(dict) {
      var newDict = {};
      for (var i in dict) {
        newDict[i] = dict[i];
      }
      return newDict;
    }


    JSONTools.getDictionarySize = getDictionarySize;
    JSONTools.clone = clone;

    window.JSONTools = JSONTools
})(window);