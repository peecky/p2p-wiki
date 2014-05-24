"use strict";

function P2pwiki() {
};
P2pwiki.prototype = {
//	_defaultData: {
//		public: {
//			pages: {}
//		},
//		privates: []
//	},
//	_defaultPage: {
//		lastModifiedAt: 0,
//		content: '',
//		pages: {}
//	},

	init: function() {
		this._data = this.load();
		this._pages = this._data.public.pages;
		this.refreshNavigator();
	},
	load: function() {
		return localStorage.wikidata ?
			JSON.parse(localStorage.wikidata) :
			{
				public: {
					pages: {}
				},
				privates: []
			};
	},
	save: function() {
		localStorage.wikidata = JSON.stringify(this._data);
	},
	mergePages: function(fromPages, toPages) {
		toPages = toPages || this._pages;
		var name;
		for (name in toPages) {
			if (!fromPages[name]) continue;
			var page1 = toPages[name];
			var page2 = fromPages[name];
			if (page1.lastModifiedAt < page2.lastModifiedAt) {
				page1.content = page2.content;
				page1.lastModifiedAt = page2.lastModifiedAt;
				this.mergePages(page1.pages, page2.pages);
			}
		}
		for (name in fromPages) {
			if (toPages[name]) continue;	// already merged
			toPages[name] = fromPages[name];
		}
	},
	isDeletedPage: function(page) {
		if (page.content) return false;
		for (var name in page.pages) {
			if (!this.isDeletedPage(page.pages[name])) return false;
		}
		return true;
	},
	generatePageNavigator: function(pages, basePath) {
		pages = pages || this._pages;
		basePath = basePath || '';
		var $ul = $('<ul>');
		for (var name in pages) {
			if (this.isDeletedPage(pages[name])) continue;
			var $li = $(_.template('<li><a href="#page=<%= pageName %>"><%= subname %></a></li>', {
				pageName: basePath + name,
				subname: name
			}));
			var $subUl = this.generatePageNavigator(pages[name].pages, basePath + name + '/');
			$li.append($subUl);
			$ul.append($li);
		}
		return $ul;
	},
	validatePageName: function(pageName) {
		return /^\w+(\/\w+)*$/.test(pageName);
	},
	cloneDefaultPage: function() {
		return  {
			lastModifiedAt: 0,
			content: '',
			pages: {}
		};
	},
	page: function(pageName, content) {
		if (!this.validatePageName(pageName)) return false;
		var doWrite = typeof content !== 'undefined';
		var i;
		var paths = pageName.split('/');
		var pages = this._pages;
		for (i = 0; i < paths.length; i++) {
			var path = paths[i];
			if (!pages[path]) {
				pages[path] = this.cloneDefaultPage();
			}
			if (i === paths.length-1) {
				if (!doWrite) return pages[path];
				else  {
					pages[path].content = content;
					pages[path].lastModifiedAt = Date.now();
				}
			}
			else pages = pages[paths[i]].pages;
		}
	},
	refreshNavigator: function() {
		$('#navigator').empty().append(this.generatePageNavigator());
	}
};

var p2pwiki = new P2pwiki();

// https://togetherjs.com/docs/
var TogetherJSConfig_toolName = 'p2pwiki',
	TogetherJSConfig_findRoom = 'p2pwiki',
	TogetherJSConfig_dontShowClicks = true,
	TogetherJSConfig_autoStart = true,
	TogetherJSConfig_suppressJoinConfirmation = true,
	TogetherJSConfig_suppressInvite = true,
	TogetherJSConfig_disableWebRTC = true,
	TogetherJSConfig_youtube = false,
	TogetherJSConfig_ignoreMessages = true,
	TogetherJSConfig_ignoreForms = true;
var TogetherJSConfig_on = {
	ready: function() {
		TogetherJS.hub.on('writePage', function(msg) {
			p2pwiki.page(msg.name, msg.content);
			p2pwiki.save();
			p2pwiki.refreshNavigator();
		});
		TogetherJS.hub.on('mergePages', function(msg) {
			p2pwiki.mergePages(msg.pages);
			p2pwiki.save();
			p2pwiki.refreshNavigator();
			if (msg.step === 1) TogetherJS.send({ type: 'mergePages', pages: p2pwiki._pages, step: 2 });
		});
		TogetherJS.send({ type: 'mergePages', pages: p2pwiki._pages, step: 1 });
	}
};

$(function() {
	$('#editor form').submit(function(event) {
		event.preventDefault();
		var $form = $(this);
		var pageName = $form.find('input[name=pageName]').val();
		var content = $form.find('textarea[name=content]').val();
		p2pwiki.page(pageName, content);
		p2pwiki.save();
		p2pwiki.refreshNavigator();
		TogetherJS.send({ type: 'writePage', name: pageName, content: content });
	});
	$(window).on('hashchange', function(event) {
		var paramString = location.hash.substr(1);
		var params = paramString.split('&');
		var paramObj = {};
		for (var i = 0; i < params.length; i++) {
			var kv = params[i].split('=');
			paramObj[kv[0]] = kv[1];
		}
		if (paramObj.page) {
			var pageName = paramObj.page;
			var page = p2pwiki.page(pageName);
			$('#editor form')
				.find('input[name=pageName]')
					.val(pageName)
				.end()
				.find('textarea[name=content]')
					.val(page.content);
		}
	});
	p2pwiki.init();
});
