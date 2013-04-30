var OptionsBackend = chrome.extension.getBackgroundPage().OptionsBackend;
var urlExpander = chrome.extension.getBackgroundPage().urlExpander;
var tweetManager = chrome.extension.getBackgroundPage().TweetManager.instance;
var ImageService = chrome.extension.getBackgroundPage().ImageService;

chrome.i18n.getMessage = chrome.extension.getBackgroundPage().chrome.i18n.getMessage;

var fadeTimeout = OptionsBackend.get('notification_fade_timeout');

try {
  var tweet = tweetManager.injectTweets.shift();
  Renderer.setContext('desktop');
  $(document.body).prepend(Renderer.renderTweet(tweet, false, OptionsBackend.get('name_attribute')));
} catch(e) {
  console.log(e);
  window.close();
}

setTimeout(function() {
  $("#progress")
  .text(chrome.i18n.getMessage("preventClosing"))
  .show()
  .css({bottom: '0px', width: '100%'})
  .animate({width: '0px'}, fadeTimeout, 'linear', function() {
    window.close();
  });

  $(document.body).click(function() {
    $('#progress').stop().hide();
  });
}, 100);

