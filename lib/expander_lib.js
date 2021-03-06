function Expander() {
  this.services = null;
  this.servicesTimer = null;
  this.urlsCache = {};
  this.retryTimeout = 10000;
  this.populateServicesCache();
  this.currentServiceIdx = 0;
}
Expander.servicesArray = ['longurl', 'untiny', 'hatena', 'viame', 'fxcamera', 'flickr', 'mobypicture'];
Expander.services = {
  longurl: {
    expand: function(url) {
      return ['http://api.longurl.org/v2/expand', {url: url, format: 'json'}, 'json'];
    },
    services: function() {
      return ['http://api.longurl.org/v2/services', {format: 'json'}, 'json'];
    },
    parseServices: function(services, data) {
      if(!services) {
        services = {};
      }
      for(var domain in data) {
        if(!services[domain]) {
          services[domain] = {};
        }
        services[domain].longurl = true;
      }
      services["amba.to"] = {longurl: true};
      services["p.tl"] = {longurl: true};
      return services;
    },
    parseExpand: function(data, status, request) {
      return data['long-url'];
    }
  },
  untiny: {
    expand: function(url) {
      return ['http://untiny.me/api/1.0/extract/', {url: url, format: 'json'}, 'json'];
    },
    services: function() {
      return ['http://untiny.me/api/1.0/services/', {format: 'json'}, 'json'];
    },
    parseServices: function(services, data) {
      if(!services) {
        services = {};
      }
      for(var domain in data) {
        if(!services[domain]) {
          services[domain] = {};
        }
        services[domain].untiny = true;
      }
      return services;
    },
    parseExpand: function(data) {
      return data.org_url;
    }
  },
  hatena: {
    expand: function(url) {
      return ['http://b.hatena.ne.jp/api/htnto/expand', {format: 'json', shortUrl: url}, 'json'];
    },
    services: function(url) {
      return ['http://b.hatena.ne.jp/api/htnto/expand', {format: 'json'}, 'json'];
    },
    parseServices: function(services, data) {
      return $.extend({}, services, {"htn.to": {hatena: true}});
    },
    parseExpand: function(data) {
      return data.data.expand[0].long_url;
    }
  },
  viame: {
    expand: function(url) {
      return ['https://api.via.me/v1/posts/' + url.split("/").pop().substring(1), {client_id: SecretKeys.viame.consumerKey}, 'json'];
    },
    services: function(url) {
      return ['http://via.me/', {}, 'html'];
    },
    parseServices: function(services, data) {
      return $.extend({}, services, {"via.me": {viame: true}});
    },
    parseExpand: function(data) {
      return data.response.post.media_url;
    }
  },
  fxcamera: {
    expand: function(url) {
      return [url, {}, 'html'];
    },
    services: function(url) {
      return ['http://fxc.am/', {}, 'html'];
    },
    parseServices: function(services, data) {
      return $.extend({}, services, {"fxc.am": {fxcamera: true}});
    },
    parseExpand: function(data) {
      return $(data).find("#photo").attr('src');
    }
  },
  flickr: {
    expand: function(url) {
      return ['https://secure.flickr.com/services/rest/', {
        method: 'flickr.photos.getSizes',
        api_key: SecretKeys.flickr.consumerKey,
        photo_id: url.split(/\/+/)[4]
      }, 'text'];
    },
    services: function(url) {
      return ['http://www.flickr.com/', {}, 'html'];
    },
    parseServices: function(services, data) {
      return $.extend({}, services, {"www.flickr.com": {flickr: true}});
    },
    parseExpand: function(data) {
      return $(data).find("size[label=Small]").attr('source');
    }
  },
  mobypicture: {
    expand: function(url) {
      var param = {
        action: 'getThumbUrl',
        key: SecretKeys.mobypicture.key,
        size: 'medium'
      };
      var post_id = '', tinyurl_code = '';
      var splited = url.split(/\/+/);
      if(splited[1] == 'www.mobypicture.com') {
        param.post_id = splited.pop();
      } else if(splited[1] == 'moby.to') {
        param.tinyurl_code = splited.pop();
      }
      return ['https://api.mobypicture.com/', param, 'text'];
    },
    services: function(url) {
      return ['http://www.mobypicture.com/', {}, 'html'];
    },
    parseServices: function(services, data) {
      return $.extend({}, services, {"www.mobypicture.com": {mobypicture: true}, "moby.to": {mobypicture: true}});
    },
    parseExpand: function(data) {
      return data;
    }
  }
};

Expander.prototype = {
  doAjaxRequest: function(url, params, dataType, successCallback, errorCallback) {
    $.ajax({
      type: 'GET',
      url: url,
      data: params,
      dataType: dataType
    })
    .done(successCallback)
    .fail(errorCallback);
  },

  populateServicesCache: function() {
    for(var service in Expander.services) {
      this.updateServicesCache(Expander.services[service]);
    }
  },

  updateServicesCache: function(service) {
    this.servicesTimer = null;
    var _this = this;
    var result = service.services();
    var url = result[0], params = result[1], dataType = result[2];
    this.doAjaxRequest(url, params, dataType, 
      function success(data, status) {
        if(!data) {
          return;
        }
        _this.services = service.parseServices(_this.services, data);
      },
      function error(request, status, error) {
        // Failed to populate services list, we're going to try again
        // upon the first expand request or in a few seconds.
        _this.servicesTimer = setTimeout(function() {
          _this.updateServicesCache(service);
        }, _this.retryTimeout);
        _this.retryTimeout = _this.retryTimeout * 2;
      }
    );
  },

  expand: function(url, callback) {
    var longUrl = this.urlsCache[url];
    var isShortened = true;
    var success = true;
    if(longUrl) {
      callback(success, isShortened, longUrl);
      return;
    }

    if(this.services) {
      var urlDomain = url.match(/(https?:\/\/|www\.)(.*?)(\/|$)/i)[2];
      var shortenerService = this.services[urlDomain];
      if(shortenerService) {
        while(true) {
          var serviceName = this.getCurrentService();
          if(shortenerService[serviceName]) {
            this.runExpander(Expander.services[serviceName], url, callback);
            break;
          }
        }
      } else {
        isShortened = false;
        success = true;
        callback(success, isShortened, url);
      }
    } else {
      callback(true, false);
    }
  },

  getCurrentService: function() {
    var chosenService = Expander.servicesArray[this.currentServiceIdx];
    this.currentServiceIdx += 1;
    this.currentServiceIdx = this.currentServiceIdx % Expander.servicesArray.length;
    return chosenService;
  },

  runExpander: function(service, shortUrl, callback) {
    var _this = this;
    var result = service.expand(shortUrl);
    var url = result[0], params = result[1], dataType = result[2];
    this.doAjaxRequest(url, params, dataType,
      function success(data, status, request) {
        var success = false;
        var isShortened = true;
        if(data) {
          success = true;
          var longUrl = service.parseExpand(data, status, request);
          if(shortUrl == longUrl) {
            isShortened = false;
          } else {
            _this.urlsCache[shortUrl] = longUrl;
          }
        }
        var longUrlDomain = longUrl.match(/(https?:\/\/|www\.)(.*?)(\/|$)/i)[2];
        if(_this.services[longUrlDomain]) {
          _this.urlsCache[shortUrl] = false;
          _this.expand(longUrl, callback);
        } else {
          callback(success, isShortened, longUrl);
        }
      },
      function error(request, status, error) {
        var success = false;
        var isShortened = true;
        callback(success, isShortened, '"' + error + '"(' + status + ')');
      }
    );
  }
};
