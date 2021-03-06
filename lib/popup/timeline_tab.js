var TimelineTab = {
  init: function() {
    $("#tabs").tabs({
      active: 0,
      beforeActivate: function(event, ui) {
        tweetManager.previousTimelineId = tweetManager.currentTimelineId;
        tweetManager.currentTimelineId = ui.newPanel.selector.split('-')[1];
        prepareAndLoadTimeline();
      },
      activate: function(event, ui) {
        ui.newPanel.find('.inner_timeline').scrollTop(tweetManager.getCurrentTimeline().currentScroll);
        document.activeElement.blur();
        ui.oldPanel.find('.inner_timeline').empty();
      }
    });
    if(OptionsBackend.get('tab_select_with_hover')) {
      $("#tabs").tabs('option', 'event', 'mouseover');
    }
  },

  addNewTab: function(templateId, automaticallyAdded) {
    var createdTimelines = tweetManager.showTimelineTemplate(templateId);
    if(templateId == TimelineTemplate.LISTS) {
      Lists.init();
    } else {
      for(var i = 0, len = createdTimelines.length; i < len; ++i) {
        var timeline = createdTimelines[i];
        pos = tweetManager.getTimelinePosition(timeline.timelineId);
        if(pos == -1) {
          pos = undefined;
        }
        if(templateId == TimelineTemplate.SEARCH) {
          SearchTab.addSearchTab(timeline.timelineId, pos, !automaticallyAdded);
        } else {
          TimelineTab.addTab(timeline.timelineId, timeline.template.timelineName, pos);
        }
      }
      ThemeManager.handleWindowResizing();
    }
    ThemeManager.updateTabsOrder();
    return createdTimelines;
  },

  addNewSearchTab: function(searchQuery, isBackground) {
    var searchTimeline;
    tweetManager.eachTimeline(function(timeline) {
      if(timeline.template.id == TimelineTemplate.SEARCH && timeline.getSearchQuery() == searchQuery) {
        searchTimeline = timeline;
        return false;
      }
      return true;
    });
    if(!searchTimeline) {
      searchTimeline = TimelineTab.addNewTab(TimelineTemplate.SEARCH, true)[0];
    }
    if(searchQuery) {
      SearchTab.updateSearch(searchTimeline.timelineId, searchQuery, isBackground);
    }
  },

  addTab: function(timelineId, tabName, pos) {
    var insertTabEl = $.parseHTML([
      '<li id="tab_\#timeline-',
      timelineId,
      '" class="timeline_tab"><a href="\#timeline-',
      timelineId,
      '"><span>',
      tabName,
      '</span></a></li>'
    ].join(''));
    var panelEl = $.parseHTML([
      '<div class="timeline" id="timeline-',
      timelineId,
      '"><div class="inner_timeline"></div></div>'
    ].join(''));
    var tabDiv = $("#tabs");
    var tabUl = tabDiv.find(".ui-tabs-nav");
    var tabLi = tabUl.find(".timeline_tab");
    var tls = tabDiv.find(".timeline");
    if($.isNumeric(pos)
    && pos < tabLi.length
    && pos < tls.length) {
      tabLi.eq(pos).before(insertTabEl);
      tls.eq(pos).before(panelEl);
    } else {
      tabUl.append(insertTabEl);
      tabDiv.append(panelEl);
    }
    var eventName = OptionsBackend.get('tab_select_with_hover')? 'mouseover': 'click';
    $("#tab_\\#timeline-"+timelineId).on(eventName, function(){
      TimelineTab.select(timelineId);
    });
    tabDiv.tabs('refresh');
    var panelEl = $("#timeline-" + timelineId).find(".inner_timeline");
    panelEl.scroll(function(e) {
      var $this = $(this);
      var timeline = tweetManager.getTimeline(timelineId);
      var threshold = 50;
      timeline.currentScroll = $this.scrollTop();
      var maxScroll = $this.prop("scrollHeight") - $this.height();
      if(maxScroll - $this.scrollTop() < threshold) {
        if(!loadingNewTweets) {
          Paginator.nextPage();
        }
      }
      $this = null;
    });
    ThemeManager.initWindowResizing($("#timeline-" + timelineId));
    ContextMenu.initSingleTimeline(timelineId);
    panelEl = null;
  },

  removeTab: function(timelineId) {
    if(timelineId == tweetManager.currentTimelineId && tweetManager.previousTimelineId) {
      this.select(tweetManager.previousTimelineId);
    }
    $("#tab_\\#timeline-"+timelineId).remove();
    $("#timeline-"+timelineId).remove();
    $("#tabs").tabs('refresh');
    tweetManager.hideTimeline(timelineId);
    ThemeManager.handleWindowResizing();
    ThemeManager.updateTabsOrder();
  },

  select: function(timelineId) {
    $("#tabs").tabs({active: $("#tab_\\#timeline-"+timelineId).index()});
  }
};
