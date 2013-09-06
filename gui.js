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
    var $logArea = $('textarea');
    $('body').append($logArea);

    window.LoggableObject.prototype.log = function (msg) {
      $logArea.append(document.createTextNode(msg));
    };    
  })(window);



})(window);