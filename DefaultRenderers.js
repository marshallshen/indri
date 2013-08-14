/*
	Standard content renderers
*/

/*
	Displays the content items as a multi-column list with small icons
*/
function ListRenderer() {
	this.name = "List"
}
ListRenderer.prototype = jQuery.extend({}, new ContentRenderer(), {
		_renderContainer : function() {
			return jQuery(document.createElement("ul")).addClass("fb-filelist").click(this, function(evt) { 
				if(evt.toElement == this) evt.data.callback(null, 'clear');
			});
		},

		_renderItem : function(contentItem) {
			var $icon = jQuery(document.createElement("img")).attr("src", this._getIcon(contentItem, "small"));
			var $label = jQuery(document.createElement("span")).addClass("fb-editable-name").html(contentItem.name);
			var $listItem = jQuery(document.createElement("li")).addClass("fb-listitem").append($icon).append($label);

			this.lookup[contentItem.id] = $listItem;
			this._setupNormalEvents($listItem, contentItem);
			return $listItem;
		},
	});


/*
	Displays content as a multi-column list with preview icons
*/
function IconRenderer() {
	this.name = "Icon"
}
IconRenderer.prototype = jQuery.extend({}, new ContentRenderer(), {

		_renderContainer : function() {
			return jQuery(document.createElement("ul")).addClass("fb-filelist fb-iconlist").click(this, function(evt) {
				if(evt.toElement == this) evt.data.callback(null, 'clear');
			});
		},

		_renderItem : function(contentItem) {
			var $icon = jQuery(document.createElement("img")).attr("src", this._getIcon(contentItem));
			var $label = jQuery(document.createElement("span")).addClass("fb-editable-name").html(contentItem.name);
			var $listItem = jQuery(document.createElement("li")).addClass("fb-iconitem").append($icon).append("<br>").append($label);

			this.lookup[contentItem.id] = $listItem;
			this._setupNormalEvents($listItem, contentItem);

			return $listItem;
		},	
	});


/*
	Displays content in a table with sortable columns
*/
function DetailRenderer() {
	this.name = "Details"
}
DetailRenderer.prototype = jQuery.extend({}, new ContentRenderer(), {

		_renderContainer : function() {
			var $tr = jQuery(document.createElement("tr"));
			this._fieldNames.forEach(function(field) {
				var $th = jQuery(document.createElement("th")).addClass("fb-detailheader").html(field)
				.click(this, function(evt){
					if(evt.toElement == this && evt.which == 1) {
						evt.data.browser.sorter.setSortField(field);
					}
				});
				$tr.append($th);
			}, this);

			return jQuery(document.createElement("table")).addClass("fb-filelist fb-detaillist")
					.append(jQuery(document.createElement("thead"))).append($tr);
		},

		_renderItem : function(contentItem) {
			var $tr = jQuery(document.createElement("tr")).addClass("fb-detailitem");

			var $label = jQuery(document.createElement("span")).addClass("fb-editable-name").html(contentItem.name);
			if(contentItem.isDir) {
				$label.addClass("fb-detailitem-dirname");
			}
			$tr.append(jQuery(document.createElement("td")).append($label));

			$tr.append(jQuery(document.createElement("td")).html(this._formatSize(contentItem.size)));
			$tr.append(jQuery(document.createElement("td")).html(this._formatDate(contentItem.created)));
			$tr.append(jQuery(document.createElement("td")).html(this._formatDate(contentItem.modified)));

			this.lookup[contentItem.id] = $tr;
			this._setupNormalEvents($tr, contentItem);

			return $tr;
		},

		_formatName : function(contentFile) {
			return contentFile.name;
		},

		_formatSize : function(size) {
			if(!size) {
				return "--";
			}

			if(size < 1024) {
				return size + " " + ((size == 1) ? "byte" : "bytes");
			}
			else if(size < 1024 * 1024) {
				return (size / 1024).toFixed(1) + " KB";
			}

			return (size / (1024 * 1024)).toFixed(1) + " MB";
		},

		_formatDate : function(timestamp) {
			return timestamp ? new Date(timestamp).toDateString() : '--';
		},

		_fieldNames : [ "name", "size", "created", "modified" ],

		dateFormatString : "yyyy-MM-dd, hh:mm ",
	});