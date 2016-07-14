// tmp monkey patch for jquery 1.11 and slickgrid for recline
// see https://github.com/mleibman/SlickGrid/issues/518#issuecomment-19272769
jQuery.browser = {};
jQuery.browser.mozilla = /mozilla/.test(navigator.userAgent.toLowerCase()) && !/webkit/.test(navigator.userAgent.toLowerCase());
jQuery.browser.webkit = /webkit/.test(navigator.userAgent.toLowerCase());
jQuery.browser.opera = /opera/.test(navigator.userAgent.toLowerCase());
jQuery.browser.msie = /msie/.test(navigator.userAgent.toLowerCase());

jQuery(window).load(function() {
  var isDatasetShow = ($('.dataset.show').length > 0);
  if (isDatasetShow) {
    datasetShowSetup();
  }

  var isDatasetSearch = ($('.js-dataset-search').length > 0);
  if (isDatasetSearch) {
    datasetSearchSetup();
  }
});

function datasetSearchSetup() {
  // set up data find typeahead
  $.getJSON('/data.json', function(data) {
    var sources = _.pluck(data.datasets, 'title');
    // turns out we have some data packages with no title
    // need to filter them out or typeahead fails ...
    sources = _.filter(sources, function(title) {
      return Boolean(title);
    });
    $('.js-dataset-search').typeahead({
      source: sources,
      updater: function(item) {
        var dataset = _.filter(data.datasets, function(ds) {
          return (ds.title == item);
        })[0]
          ;
        window.location = '/data/' + dataset.owner + '/' + dataset.name;
      }
    });
  });
}

function findResourceIndex(views, datapackage) {
  var resourceName = views[0].resourceName || ''
    , resourceIndex = 0
    , resources = datapackage.resources || []
    , len = resources.length
    , idx = 0
    ;

  for (; idx < len; idx += 1) {
    if (resources[idx].name === resourceName) {
      resourceIndex = idx;
      break;
    }
  }

  return resourceIndex;
}

function datasetShowSetup() {
  // DataFileData will be defined in Jinja template
  if (DataViews.length > 0) {
    var datafile = new Catalog.Models.DataFile(DataPackageData);
    var resourceIndex = findResourceIndex(DataViews, DataPackageData);
    var view = new Catalog.Views.DataFile({
      model: datafile,
      el: $('.viewer')
    });
    view.render(resourceIndex);
  }

  // create a grid view for each resource in the page
  $('.js-show-handsontable-grid').each(function(idx, $el) {
    var resourceIndex = $($el).data('resource-index');
    var reclineDataset = Catalog.dataPackageResourceToDataset(DataPackageData, resourceIndex);
    var hot;
    
    CSV.fetch({ 
      "url": reclineDataset.attributes.remoteurl
    }).done(function(dataset) {
      var options = {
        data: dataset.records,
        colHeaders: dataset.fields,
        readOnly: true,
        
        height: function(){
          if (dataset.records.length > 16) {return 432;}
        },
        colWidths: 47,
        rowWidth: 27,
        stretchH: 'all',
        columnSorting: true,
        search: true
      };
      hot = new Handsontable($el, options);
    });
      
    // search option 
    var index = 1;
    var search = $($el).siblings('input')[0];
    Handsontable.Dom.addEvent(search,'keyup', function (event) {
      var queryResult = hot.search.query(this.value);
      if (queryResult) {
        if (event.keyCode == 13 & index < queryResult.length) {
          hot.selectCell(queryResult[index].row,queryResult[index].col);
          index ++;
        }else{
          hot.selectCell(queryResult[0].row,queryResult[0].col);
          index = 1
        }
      }
      hot.render();
    });
  });
  
  $('.js-show-geojson').each(function(idx, $el) {
    $el = $($el);
    var resourceIndex = $el.data('resource-index');
    var resource = DataPackageData.resources[resourceIndex];
    var dataUrl = resource.localurl || resource.url;
    // TODO: error handling
    $.getJSON(dataUrl, function(geoJsonData) {
      var map = new L.Map($el.get(0));
      var mapUrl = "//otile{s}-s.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png";
      var osmAttribution = 'Map data &copy; 2011 OpenStreetMap contributors, Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="//developer.mapquest.com/content/osm/mq_logo.png">';
      var bg = new L.TileLayer(mapUrl, {maxZoom: 18, attribution: osmAttribution ,subdomains: '1234'});
      map.addLayer(bg);

      var myLayer = L.geoJson().addTo(map);
      myLayer.addData(geoJsonData);

      map.fitBounds(myLayer.getBounds());
    });
  });
}
