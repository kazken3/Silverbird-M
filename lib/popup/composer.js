var Composer = {
  replyId: null,
  replyUser: null,
  rtId: null,
  destroyId: null,
  favoriteId: null,
  destroyTimelineId: null,
  macCommandKey: false,

  bindEvents: function() {
    var baseElement = $("#compose_tweet_area");

    baseElement.find("textarea").on("keydown blur", Composer.textareaChanged.bind(Composer));
    $("#tweetit").on("click", Composer.sendTweet.bind(Composer));
    $("#image_input").on("change", ImageUpload.upload.bind(ImageUpload));
    $("#compose_tweet").on("click", function() {
      Composer.showComposeArea();
    });

    $("#shortener_area").find("input")
    .on("focus", Shortener.focus.bind(Shortener))
    .on("keyup", Shortener.changed.bind(Shortener))
    .on("blur", Shortener.blur.bind(Shortener));
    $("#shorten_current").on("click", Shortener.shortenCurrentPage.bind(Shortener));
    $("#shortener_button").on("click", function() {
      Shortener.shortenIt();
    });

  },

  init: function() {
    if(tweetManager.composerData.isComposing) {
      Composer.initMessage(tweetManager.composerData.saveMessage, tweetManager.composerData.replyId,
          tweetManager.composerData.replyUser, false);
    }
    Composer.textareaChanged();
  },

  initMessage: function(message, replyId, replyUser, shouldAnimate) {
    Composer.replyId = replyId;
    Composer.replyUser = replyUser;
    $("#compose_tweet_area").find("textarea").val(message || '');
    Composer.showComposeArea(true, !shouldAnimate);
    Composer.textareaChanged();
  },

  share: function (node) {
    Composer.showComposeArea(true);
    var $node = $(node);
    var el = $("#compose_tweet_area").find("textarea");
    var user = $node.find(".user").attr('screen_name');
    var msg = $node.find(".text").text();
    $node.find(".text").find("a").each(function() {
      var $this = $(this);
      var linkHref = $this.attr('href'),
          linkText = $this.text();
      if (linkHref && linkHref !== '#') {
        msg = msg.replace(linkText, linkHref);
      }
      $this = null;
    });

    el.val("RT @" + user + ": " + msg);
    Composer.textareaChanged();
  },

  confirmDestroy: function() {
    $("#loading").show();
    $(".rt_confirm").hide();
    var _this = this;

    tweetManager.destroy(function(success, data, status) {
      $("#loading").hide();
      var notFound = status && status.match(/Not Found/);
      if(success || notFound) {
        $(".tweet").find(["[tweetid='", _this.destroyId, "']"].join('')).parents('.tweet_space').first().hide('blind', { direction: "vertical" });
        var currentCount = tweetManager.getCurrentTimeline().getTweetsCache().length;
        if(currentCount < OptionsBackend.get('tweets_per_page')) {
          Paginator.nextPage();
        }
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_deletingTweet", status), Composer.confirmDestroy.bind(Composer));
      }
    }, this.destroyTimelineId, this.destroyId);
  },

  denyDestroy: function() {
    $(".rt_confirm").hide();
  },

  destroy: function (node) {
    var $node = $(node);
    $(".rt_confirm").hide();
    $node.find(".rt_confirm.destroy").show();
    this.destroyId = $node.attr('tweetid');
    this.destroyTimelineId = $node.attr('timelineid');
  },

  confirmRT: function() {
    $("#loading").show();
    $(".rt_confirm").hide();
    var _this = this;
    tweetManager.postRetweet(function(success, data, status) {
      $("#loading").hide();
      if(success) {
        loadTimeline(true, "home");
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_retweeting", status), Composer.confirmRT.bind(Composer));
      }
    }, _this.rtId);
  },

  denyRT: function() {
    $(".rt_confirm").hide();
  },

  retweet: function (node) {
    var $node = $(node);
    $(".rt_confirm").hide();
    $node.find(".rt_confirm").show();
    this.rtId = $node.attr('tweetid');
  },

  favorite: function (node) {
    if(node) {
      this.favoriteId = $(node).attr('tweetid');
    }
    var loading = $("#loading");
    loading.show();
    tweetManager.favorite(function(success, data, status) {
      loading.hide();
      if(success) {
         Paginator.needsMore = false;
         loadTimeline();
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_markFavorite", status), Composer.favorite.bind(Composer));
      }
    }, this.favoriteId);
  },

  unFavorite: function (node) {
    if(node) {
      this.favoriteId = $(node).attr('tweetid');
    }
    var loading = $("#loading");
    loading.show();
    tweetManager.unFavorite(function(success, data, status) {
      loading.hide();
      if(success) {
         Paginator.needsMore = false;
         loadTimeline();
      } else {
        Renderer.showError(chrome.i18n.getMessage("ue_unmarkFavorite", status), Composer.unFavorite.bind(Composer));
      }
    }, this.favoriteId);
  },

  addUser: function (replies) {
    var textArea = $("#compose_tweet_area").find("textarea");
    var currentVal = textArea.val();
    replies =  replies || [];
    if(currentVal.length > 0 && currentVal[currentVal.length - 1] != ' ') {
      currentVal += ' ';
    }
    currentVal += replies.join(' ') + ' ';
    textArea.val(currentVal);
  },

  reply: function (node) {
    Composer.showComposeArea(true);

    var $node = $(node);
    var textArea = $("#compose_tweet_area").find("textarea");
    var user = $node.find(".user").attr('screen_name');
    var timelineId = $node.attr('timelineid');

    if(timelineId == TimelineTemplate.RECEIVED_DMS || timelineId == TimelineTemplate.SENT_DMS) {
      textArea.val("d " + user + " ");
      Composer.textareaChanged();
      return;
    }

    var currentVal = textArea.val();
    var replies = ['@'+user];
    var ownName = tweetManager.twitterBackend.username();
    if (reply_all) {
      $node.find(".text").find('a').each(function(){
        var t = $(this).text();
        if (t !== ownName && (/^[A-Z0-9_-]{1,15}$/i).test(t)) {
          var user = '@' + t;
          if (replies.indexOf(user) == -1)
            replies.push(user);
        }
      });
    }

    if(Composer.replyId && currentVal.indexOf(Composer.replyUser) != -1) {
      this.addUser(replies);
      Composer.textareaChanged();
      return;
    }

    this.addUser(replies);
    tweetManager.composerData.replyId = Composer.replyId = $node.attr('tweetid');
    tweetManager.composerData.replyUser = Composer.replyUser = user;

    Composer.textareaChanged();
  },

  showComposeArea: function (showOnly, noAnimation) {
    var composeArea = $("#compose_tweet_area");
    var textarea = $("textarea", composeArea);
    var visible = (composeArea.css('display') != 'none');
    var tmCompose = tweetManager.composerData;

    if(!visible) {
      if(noAnimation) {
        composeArea.show();
      } else {
        composeArea.show('blind', { direction: "vertical" }, 'normal', function() {
          textarea[0].selectionStart = textarea[0].selectionEnd = textarea.val().length;
          textarea.focus();
        });
      }
      $("#compose_tweet").find("img").attr('src', 'img/arrow_up.gif');
      $("#composeTweet").text(chrome.i18n.getMessage('closeComposeTweet'));
      tmCompose.isComposing = true;
      tmCompose.replyId = Composer.replyId;
      tmCompose.replyUser = Composer.replyUser;
    } else if(!showOnly) {
      if(noAnimation) {
        composeArea.hide();
      } else {
        composeArea.hide('blind', { direction: "vertical" });
      }
      $("#compose_tweet").find("img").attr('src', 'img/arrow_down.gif');
      $("#composeTweet").text(chrome.i18n.getMessage('composeTweet'));
      tmCompose.saveMessage = '';
      tmCompose.isComposing = false;
      tmCompose.replyId = null;
      tmCompose.replyUser = null;
      Shortener.closeArea();
    }

    if((visible && showOnly) || (!visible && noAnimation)) {
      textarea[0].selectionStart = textarea[0].selectionEnd = textarea.val().length;
      textarea.focus();
    }
  },

  textareaChanged: function (e) {
    var composeArea = $("#compose_tweet_area");
    var el = composeArea.find("textarea");
    var str = el.val();
    tweetManager.composerData.saveMessage = str;
    var stringCount = 0;
    var link = new RegExp('https?://.+? ', 'g');
    if(link.test(str)) {
      stringCount = str.replace(link, '*********************** ').length;
    } else {
      stringCount = str.length;
    }
    var availableChars = MAX_TWEET_SIZE - stringCount;
    var charsLeftEl = composeArea.find(".chars_left");
    charsLeftEl.text(availableChars);
    if(availableChars < 0 || availableChars == MAX_TWEET_SIZE) {
      if(availableChars < 0) {
        charsLeftEl.css('color', 'red');
      }
      composeArea.find("input").find("[type='button']").attr("disabled", "disabled");
    } else {
      charsLeftEl.css('color', 'black');
      composeArea.find("input").find("[type='button']").removeAttr("disabled");
      if(e && (e.ctrlKey || Composer.macCommandKey) && e.which == 13) { // Ctrl + Enter or MacCommand + Enter
        this.sendTweet();
      }
    }
    if(e && (e.which == 91 || e.which == 93)) {
      Composer.macCommandKey = true;
    } else {
      Composer.macCommandKey = false;
    }
  },

  sendTweet: function () {
    var textarea = $("#compose_tweet_area").find("textarea");
    tweetManager.enqueueTweet(textarea.val(), Composer.replyId, Composer.replyUser);

    textarea.val("");
    Composer.replyId = null;
    Composer.textareaChanged();
    Composer.showComposeArea();
    Shortener.clear();
  },

  refreshNew: function() {
    // FIXME: #loading shouldn't be used for that.
    if($("#loading").css("display") != 'none') {
      return;
    }
    loadTimeline(true);
  },

  isVisible: function() {
    var composeArea = $("#compose_tweet_area");
    var textarea = composeArea.find("textarea");
    var visible = (composeArea.css("display") != 'none');
    return visible && textarea.val().length > 0;
  },

  addText: function(value) {
    var textarea = $("#compose_tweet_area").find("textarea");
    var tmpText = textarea.val();
    if(tmpText.length > 0) {
      if((textarea[0].selectionStart > 0) &&
        (tmpText[textarea[0].selectionStart-1] != ' ')) {
        value = ' ' + value;
      }
      if((textarea[0].selectionEnd < tmpText.length) &&
         (tmpText[textarea[0].selectionEnd+1] != ' ')) {
         value += ' ';
      }
    }
    textarea.insertAtCaret(value);
    Composer.textareaChanged();
  }
};
