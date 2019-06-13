(function () {
    var Ext = window.Ext4 || window.Ext;

var gApp = null;

Ext.define('Rally.apps.PortfolioItemCopy.app', {
    extend: 'Rally.app.TimeboxScopedApp',
    settingsScope: 'project',
    componentCls: 'app',
    config: {
        defaultSettings: {
            keepTypesAligned: true,
            hideArchived: true,
            showFilter: true,
            allowMultiSelect: false,
            useColour: false
        }
    },
    getSettingsFields: function() {
        var returned = [
            {
                name: 'allowMultiSelect',
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Enable multiple start items (Note: Page Reload required if you change value)',
                labelAlign: 'top'
            },
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Show Advanced filter',
                name: 'showFilter',
                labelAlign: 'top'
            }
        ];
        return returned;
    },
    itemId: 'rallyApp',
        STORE_FETCH_FIELD_LIST:
            [
                'Name',
                'FormattedID',
                'Parent',
                'DragAndDropRank',
                'Children',
                'ObjectID',
                'Project',
                'DisplayColor',
                'Owner',
                'Blocked',
                'BlockedReason',
                'Ready',
                'Tags',
                'Workspace',
                'RevisionHistory',
                'CreationDate',
                'PercentDoneByStoryCount',
                'PercentDoneByStoryPlanEstimate',
                'PredecessorsAndSuccessors',
                'State',
                'PreliminaryEstimate',
                'Description',
                'Notes',
                'Predecessors',
                'Successors',
                'OrderIndex',   //Used to get the State field order index
                'PortfolioItemType',
                'Ordinal',
                'Release',
                'Iteration',
                'Milestones',
                'UserStories',
                'Attachments',
                //Customer specific after here. Delete as appropriate
                'c_ProjectIDOBN',
                'c_QRWP',
                'c_ProgressUpdate',
                'c_RAIDSeverityCriticality',
                'c_RISKProbabilityLevel',
                'c_RAIDRequestStatus'   
            ],

    items: [
        {  
            xtype: 'container',
            itemId: 'filterBox'
        },{
            xtype: 'container',
            itemId: 'selectionBox',
            listeners: {
                afterrender:  function() {  gApp = this.up('#rallyApp'); gApp._onElementValid(this);},
            }

        }
    ],

    timer: null,
    
    _resetTimer: function(callFunc) {
        if ( gApp.timer) { clearTimeout(gApp.timer);}
        gApp.timer = setTimeout(callFunc, 2000);    //Debounce user selections to the tune of two seconds
    },

    _nodeTree: null,

    //Continuation point after selectors ready/changed
    _enterMainApp: function() {

        //Get all the nodes and the "Unknown" parent virtual nodes
        var nodetree = gApp._createTree(gApp._nodes);
        gApp._nodeTree = nodetree;      //Save for later
        gApp._refreshTree();
    },
    
    _refreshTree: function(){
        debugger;
    },

    //Entry point after creation of render box
    _onElementValid: function(rs) {
        gApp.timeboxScope = gApp.getContext().getTimeboxScope(); 
        //Add any useful selectors into this container ( which is inserted before the rootSurface )
        //Choose a point when all are 'ready' to jump off into the rest of the app
        var hdrBoxConfig = {
            xtype: 'container',
            itemId: 'headerBox',
            layout: 'hbox',
            items: [
                
                {
                    xtype:  'rallyportfolioitemtypecombobox',
                    itemId: 'piType',
                    fieldLabel: 'Choose Portfolio Type :',
                    labelWidth: 100,
                    margin: '5 0 5 20',
                    defaultSelectionPosition: 'first',
//                    storeConfig: {
//                        sorters: {
//                            property: 'Ordinal',
//                            direction: 'ASC'
//                        }
//                    },
                    listeners: {
                        select: function() { gApp._kickOff();},    //Jump off here to add portfolio size selector
                    }
                },
            ]
        };
        
        var hdrBox = this.insert (0,hdrBoxConfig);
        
    },

    _nodes: [],

    onSettingsUpdate: function() {
        if ( gApp._nodes) gApp._nodes = [];
        gApp._topLevel( gApp.down('#itemSelector').valueModels);
    },

    onTimeboxScopeChange: function(newTimebox) {
        this.callParent(arguments);
        gApp.timeboxScope = newTimebox;
        if ( gApp._nodes) gApp._nodes = [];
        gApp._topLevel( [gApp.down('#itemSelector').getRecord()]);
    },

    _onFilterChange: function(inlineFilterButton){
        gApp.advFilters = inlineFilterButton.getTypesAndFilters().filters;
        inlineFilterButton._previousTypesAndFilters = inlineFilterButton.getTypesAndFilters();
        if ( gApp._nodes.length) {
            gApp._nodes = [];
            gApp._topLevel( [gApp.down('#itemSelector').getRecord()]);
        }
    },

    _onFilterReady: function(inlineFilterPanel) {
        gApp.down('#filterBox').add(inlineFilterPanel);
    },

    _kickOff: function() {
        var ptype = gApp.down('#piType');
        var hdrBox = gApp.down('#headerBox');
        gApp._typeStore = ptype.store;
        var selector = gApp.down('#itemSelector');
        if ( selector) {
            selector.destroy();
        }
        var is = hdrBox.insert(2,{
            xtype: 'rallyartifactsearchcombobox',
            fieldLabel: 'Choose Start Item :',
            itemId: 'itemSelector',
            multiSelect: gApp.getSetting('allowMultiSelect'),
            labelWidth: 100,
            queryMode: 'remote',
            allowNoEntry: false,
            pageSize: 200,
            width: 600,
            margin: '10 0 5 20',
            stateful: true,
            stateId: this.getContext().getScopedStateId('itemSelector'),
            storeConfig: {
                models: [ 'portfolioitem/' + ptype.rawValue ],
                fetch: gApp.STORE_FETCH_FIELD_LIST,
                context: gApp.getContext().getDataContext(),
                pageSize: 200,
                autoLoad: true
            },
            listeners: {
                // select: function(selector,records) {
                //     this.startAgain(selector,this.valueModels);
                // },
                change: function(selector,records) {
                    if (records && (records.length > 0)) {
                        gApp._resetTimer(this.startAgain);
                    }
                }
            },
            startAgain: function () {
                var records = gApp.down('#itemSelector').valueModels;
                if ( gApp._nodes) gApp._nodes = [];
                if (records && (records.length > 1)) {
                        gApp._nodes.push({'Name': 'Combined View',
                        'record': {
                            'data': {
                                '_ref': 'root',
                                'Name': ''
                            }
                        },
                        'local':true
                    });
                }
                gApp._topLevel(records);
            }
        });   

//        Ext.util.Observable.capture( is, function(event) { console.log('event', event, arguments);});
        if(gApp.getSetting('showFilter') && !gApp.down('#inlineFilter')){
            hdrBox.add({
                xtype: 'rallyinlinefiltercontrol',
                name: 'inlineFilter',
                itemId: 'inlineFilter',
                margin: '10 0 5 20',                           
                context: this.getContext(),
                height:26,
                inlineFilterButtonConfig: {
                    stateful: true,
                    stateId: this.getContext().getScopedStateId('inline-filter'),
                    context: this.getContext(),
//                    modelNames: ['PortfolioItem/' + ptype.rawValue], //NOOOO!
                    modelNames: gApp._getModelFromOrd(0), //We actually want to filter the features... YESSSS!
                    filterChildren: false,
                    inlineFilterPanelConfig: {
                        quickFilterPanelConfig: {
                            defaultFields: ['ArtifactSearch', 'Owner']
                        }
                    },
                    listeners: {
                        inlinefilterchange: this._onFilterChange,
                        inlinefilterready: this._onFilterReady,
                        scope: this
                    } 
                }
            });
        }

        if (!gApp.down('#infoButton')){
                hdrBox.add( {
                xtype: 'rallybutton',
                itemId: 'infoButton',
                margin: '10 0 5 20',
                align: 'right',
                text: 'Page Info',
                handler: function() {
                    Ext.create('Rally.ui.dialog.Dialog', {
                        autoShow: true,
                        draggable: true,
                        closable: true,
                        width: 500,
                        autoScroll: true,
                        maxHeight: 600,
                        title: 'Information about this app',
                        items: {
                            xtype: 'component',
                            html: 
                                '<p class="boldText">Hierarchical Tree View</p>' +
                                '<p>This app will find all the children of a particular Portfolio artefact. You can choose the type of artefact,' +
                                ' then the top level artefact itself.</p>' +
                                '<p>The colours of the circles indicate the state of progress from red (those that are not started), through to' +
                                ' blue (in their final stages). Click on the "Colour Codes" button to see the colour to state mapping for each' +
                                ' portfolio item type.</p>' +
                                '<p class="boldText">Choosing collections</p>' +
                                '<p>The app settings contains an option to allow you to multi-select the top level artefacts. This allows you to' +
                                ' choose a number of portfolio items of interest and then filter for the features</p>' +
                                '<p class="boldText">Visualising Dependencies</p>' +
                                '<p>The edge of the circle will be red if there are any dependencies (predecessors or successors) and the colour ' +
                                'of the associated text will indicate those with predecessors (red text) and those with successors (green text). ' +
                                'Those with both will appear as having predecessors</p>' +
                                '<p>If the text is blinking, it means that the relevant dependency is not being shown in this data set. </p>' +
                                '<p class="boldText">Exploring the data</p><p>You can investigate dependencies by using &lt;shift&gt;-Click ' +
                                'on the circle. This will call up an overlay with the relevant dependencies. Clicking on the FormattedID on any' +
                                ' artefact in the overlay will take you to it in either the EDP or QDP page (whichever you have enabled for your' +
                                ' session )</p>' +
                                '<p>If you click on the circle without using shift, then a data panel will appear containing more information about that artefact</p>' +
                                '<p class="boldText">Filtering</p>' +
                                '<p>There are app settings to enable the extra filtering capabilities on the main page, so that you can choose which lowest-level portfolio items to see' +
                                ' e.g. filter on Owner, Investment Type, etc. </p><p>To filter by release (e.g. to find all those features scheduled into a Program Increment)' +
                                ' you will need to edit the Page settings (not the App Settings) to add a Release or Milestone filter</p>' +
                                '<p>Source code available here: <br/><a href=https://github.com/nikantonelli/PortfolioItem-Tree-With-Dependencies> Github Repo</a></p>',
                            padding: 10
                        }
                    });
                }
            } );
        }
    },


    _topLevel: function(data) {
        gApp._recurseLevel(data).then ({
            success: function() {
                console.log(gApp._nodes);
                debugger;
            }
        })
    },

    _recurseLevel: function(data) {
        var promises = [];
        var deferred = Ext.create('Deft.Deferred');

        _.each(data, function(item) {
            promises=promises.concat( gApp._getArtifacts(item));
        });

        if (promises.length > 0) {
            console.log('Attempting ' + promises.length + ' promises');
            Deft.Promise.all(promises).then({
                success: function() {
                    deferred.resolve();
                }
            });
        }
        else {
            console.log('Nothing to do for ', data);
            deferred.resolve();
        }

        return deferred.promise;
    },

    _processResult: function (type, record, records, success, promise) {
        if (success) {
            if (records && records.length)  {
                console.log('Recursing for record: ' + record.get('FormattedID'));
                gApp._recurseLevel(records).then ({
                    success: function() {
                        console.log('Completed ' + type + ' recurse for record: ' + record.get('FormattedID'));
                        promise.resolve();
                    },
                    failure: function() {
                        console.log('Failed to complete recurse for ' + record.get('FormattedID'))
                        promise.resolve();
                    }
                });
            }
            else {
                console.log('Nothing to do for ' + record.get('FormattedID'));
                promise.resolve();
            }
        }
        else {
            console.log('Failed to load for record: ' + record.get('FormattedID'));
            promise.resolve();
        }
    },

    _getArtifacts: function(record) {
        //On re-entry send an event to redraw
        var newNode = gApp._createNodes([record]);
        gApp._nodes = gApp._nodes.concat( newNode);    //Add what we started with to the node list

        console.log('Adding: ' + record.get('FormattedID'));

        var promises = [];

        //Starting with highest selected by the combobox, go down

//        _.each(data, function(record) {
            //The lowest level portfolio item type has 'UserStories' not 'Children'
            if (record.hasField('Children')){ 
                var childPromise = Ext.create('Deft.Deferred');
                promises.push(childPromise.promise);
                var childrenConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('Children', record, records, success, childPromise);
                    },
                    filters: []
                };
                //Archived only exists on Portfolio items
                if (gApp.getSetting('hideArchived')&& (!record.data._ref.includes('hierarchicalrequirement'))){ 
                    childrenConfig.filters.push({
                        property: 'Archived',
                        operator: '=',
                        value: false
                    });
                }

                if(gApp.getSetting('showFilter') && gApp.advFilters && gApp.advFilters.length > 0){
                    Ext.Array.each(gApp.advFilters,function(filter){
                        childrenConfig.filters.push(filter);
                    });
                }

                record.getCollection( 'Children').load( childrenConfig );
            }

            if (record.hasField('UserStories')){ 
                var usPromise = Ext.create('Deft.Deferred');
                promises.push(usPromise.promise);

                var UserStoriesConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('User Story', record, records, success, usPromise);
                    
                    },
                    filters: []
                };
                //Archived doesn't exist on Stories,Defects, etc.,
                if(gApp.getSetting('showFilter') && gApp.advFilters && gApp.advFilters.length > 0){
                    Ext.Array.each(gApp.advFilters,function(filter){
                        UserStoriesConfig.filters.push(filter);
                    });
                }

                record.getCollection( 'UserStories').load( UserStoriesConfig );
            }

            if (record.hasField('Defects')){ 
                var defectPromise = Ext.create('Deft.Deferred');
                promises.push(defectPromise.promise);

                var defectsConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('Defect', record, records, success, defectPromise);
                    },
                    filters: []
                };
                if(gApp.getSetting('showFilter') && gApp.advFilters && gApp.advFilters.length > 0){
                    Ext.Array.each(gApp.advFilters,function(filter){
                        defectsConfig.filters.push(filter);
                    });
                }

                record.getCollection( 'Defects').load( defectsConfig );
            }

            if (record.hasField('Tasks') ){
                //We are Defects or UserStories when we come here
                var taskPromise = Ext.create('Deft.Deferred');
                promises.push(taskPromise.promise);
                var taskConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        gApp._processResult('Task', record, records, success, taskPromise);
                    }
                };
                record.getCollection( 'Tasks').load( taskConfig );
            }

            if (record.hasField('TestCases')) {
                //Now create a new config for Test Cases 
                var testCasePromise = Ext.create('Deft.Deferred');
                promises.push(testCasePromise.promise);
                var testCaseConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        gApp._processResult('TestCase', record, records, success, testCasePromise);
                    }
                };
                record.getCollection( 'TestCases').load( testCaseConfig );
            }

            if (record.hasField('TestCaseStep')) {
                //Now create a new config for testcasesteps 
                var testCaseStepPromise = Ext.create('Deft.Deferred');
                promises.push(testCaseStepPromise.promise);

                var testCaseStepConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp.STORE_FETCH_FIELD_LIST,
                    callback: function(records, operation, success) {
                        gApp._processResult('TestCaseStep', record, records, success, testCaseStepPromise);
                    }
                };
                record.getCollection( 'TestCaseStep').load( testCaseStepConfig );
            }
                

            
        // });
        return promises;
    },

    _createNodes: function(data) {
        //These need to be sorted into a hierarchy based on what we have. We are going to add 'other' nodes later
        var nodes = [];
        //Push them into an array we can reconfigure
        _.each(data, function(record) {
            var localNode = (gApp.getContext().getProjectRef() === record.get('Project')._ref);
            nodes.push({'Name': record.get('FormattedID'), 'record': record, 'local': localNode, 'dependencies': []});
        });
        return nodes;
    },

    _findNode: function(nodes, recordData) {
        var returnNode = null;
            _.each(nodes, function(node) {
                if (node.record && (node.record.data._ref === recordData._ref)){
                     returnNode = node;
                }
            });
        return returnNode;

    },
    _findParentType: function(record) {
        //The only source of truth for the hierachy of types is the typeStore using 'Ordinal'
        var ord = null;
        for ( var i = 0;  i < gApp._typeStore.totalCount; i++ )
        {
            if (record.data._type === gApp._typeStore.data.items[i].get('TypePath').toLowerCase()) {
                ord = gApp._typeStore.data.items[i].get('Ordinal');
                break;
            }
        }
        ord += 1;   //We want the next one up, if beyond the list, set type to root
        //If we fail this, then this code is wrong!
        if ( i >= gApp._typeStore.totalCount) {
            return null;
        }
        var typeRecord =  _.find(  gApp._typeStore.data.items, function(type) { return type.get('Ordinal') === ord;});
        return (typeRecord && typeRecord.get('TypePath').toLowerCase());
    },
    _findNodeById: function(nodes, id) {
        return _.find(nodes, function(node) {
            return node.record.data._ref === id;
        });
    },
    _findParentNode: function(nodes, child){
        if (child.record.data._ref === 'root') return null;
        var parent = child.record.data.Parent;
        var pParent = null;
        if (parent ){
            //Check if parent already in the node list. If so, make this one a child of that one
            //Will return a parent, or null if not found
            pParent = gApp._findNode(nodes, parent);
        }
        else {
            //Here, there is no parent set, so attach to the 'null' parent.
            var pt = gApp._findParentType(child.record);
            //If we are at the top, we will allow d3 to make a root node by returning null
            //If we have a parent type, we will try to return the null parent for this type.
            if (pt) {
                var parentName = '/' + pt + '/null';
                pParent = gApp._findNodeById(nodes, parentName);
            }
        }
        //If the record is a type at the top level, then we must return something to indicate 'root'
        return pParent?pParent: gApp._findNodeById(nodes, 'root');
    },
        //Routines to manipulate the types

    _getSelectedOrdinal: function() {
        return gApp.down('#piType').lastSelection[0].get('Ordinal');
    },

     _getTypeList: function(highestOrdinal) {
        var piModels = [];
        _.each(gApp._typeStore.data.items, function(type) {
            //Only push types below that selected
            if (type.data.Ordinal <= (highestOrdinal ? highestOrdinal: 0) )
                piModels.push({ 'type': type.data.TypePath.toLowerCase(), 'Name': type.data.Name, 'ref': type.data._ref, 'Ordinal': type.data.Ordinal});
        });
        return piModels;
    },

    _highestOrdinal: function() {
        return _.max(gApp._typeStore.data.items, function(type) { return type.get('Ordinal'); }).get('Ordinal');
    },
    _getModelFromOrd: function(number){
        var model = null;
        _.each(gApp._typeStore.data.items, function(type) { if (number == type.get('Ordinal')) { model = type; } });
        return model && model.get('TypePath');
    },

    _getOrdFromModel: function(modelName){
        var model = null;
        _.each(gApp._typeStore.data.items, function(type) {
            if (modelName == type.get('TypePath').toLowerCase()) {
                model = type.get('Ordinal');
            }
        });
        return model;
    },

    _createTree: function (nodes) {
        //Try to use d3.stratify to create nodet
        var nodetree = d3.stratify()
                    .id( function(d) {
                        var retval = (d.record && d.record.data._ref) || null; //No record is an error in the code, try to barf somewhere if that is the case
                        return retval;
                    })
                    .parentId( function(d) {
                        var pParent = gApp._findParentNode(nodes, d);
                        return (pParent && pParent.record && pParent.record.data._ref); })
                    (nodes);
        return nodetree;
    },

    refetchTree: function() {
        gApp._enterMainApp();
    },

    _getNodeId: function(d){
        if (d.data.record.data._ref === 'root') { return Ext.id();}
        return d.data.record? d.data.record.get('FormattedID'): Ext.id();
    },

    launch: function() {

        this.on('refetchTree', this.refetchTree);
    },

    initComponent: function() {
        this.callParent(arguments);
        this.addEvents('refetchTree');
    },

});
}());