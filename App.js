(function () {
    var Ext = window.Ext4 || window.Ext;

var gApp = null;

Ext.define('Rally.apps.PortfolioItemCopy.app', {
    extend: 'Rally.app.TimeboxScopedApp',
    settingsScope: 'project',
    componentCls: 'app',
    config: {
        defaultSettings: {
            showFilter: true,
            allowMultiSelect: true,
            extendedCopy: false
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
            },
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Extended Copy',
                name: 'extendedCopy',
                labelAlign: 'top'
            }
        ];
        return returned;
    },
    itemId: 'rallyApp',

    // Defaults are those used to decide on the tree
    // Extended are all those that get copied with extendedCopy set
    //##TODO Custom fields will be used to do a mapping
    fieldList: {
        'portfoliotemLevelXFields': {
            defaults: ['State', 'PortfolioItemType', 'Children'],
            custom: []
        },

        'portfolioitemLevel1Fields': {
            defaults: ['State', 'PortfolioItemType', 'UserStories'],
            custom: []
        },

        'userstoryFields': {
            defaults: ['ScheduleState', 'Defects', 'Tasks', 'TestCases', 'Children'],
            custom: []
        },

        'defectFields': {
            defaults: ['State','Tasks', 'TestCases'],
            custom: []
        },

        'taskFields': {
            defaults: ['State', 'ToDo'],
            custom: []
        },

        'testcaseFields': {
            defaults: [],
            extended: ['Method', 'Objective','Package', 'PostConfitions', 'PreConditions' ],
            custom: []
        },

        'testcasestepFields': {
            defaults: [],
            extended: ['ExpectedResult', 'Input' ],
            custom: []
        }
    },

        //The inital fields that help you decide on what items are important. When we come to do the copy
        //we will copy as many fields as we can depending on the type of artefact
        //We fetch Attachments, Tags, etc., so we can count them to give stats to the user.
        //The less data you ask for the quicker the initial search will be (network traffic)
    REQUIRED_FETCH_LIST:
    [
                'Attachments',
//                'CreationDate',
//                'Description',
//                'DisplayColor',
//                'DragAndDropRank',
                'FormattedID',
//                'Iteration',
//                'Milestones',
//                'Name',
//                'Notes',
                'ObjectID',
                'OrderIndex', 
                'Ordinal',
//                'Owner',
//                'Parent',
//                'PercentDoneByStoryCount',
//                'PercentDoneByStoryPlanEstimate',
                
//                'Predecessors',
                'PredecessorsAndSuccessors',
//                'PreliminaryEstimate',
                'Project',
//                'Ready',
//                'Release',
                'RevisionHistory',
//                'Successors',
                'Tags',
                'Type',
//                'Workspace',

                //Customer specific after here. Delete as appropriate
                // 'c_ProjectIDOBN',
                // 'c_QRWP',
                // 'c_ProgressUpdate',
                // 'c_RAIDSeverityCriticality',
                // 'c_RISKProbabilityLevel',
                // 'c_RAIDRequestStatus'   
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
                fetch: gApp.INITIAL_FETCH_LIST,
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
                                '<p class="boldText">Hierarchical Tree Copy</p>',
                            padding: 10
                        }
                    });
                }
            } );
        }
    },


    _checkModelEquality: function(){
        var deferred = Ext.create('Deft.Deferred');
        debugger;
        //Give the user a modal shows issues and that asks if you want to continue. If not, reject the deferred
        deferred.reject(); //Dummy 

        return deferred.promise;
    },

    _addDependencies: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying dependencies');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _copyTags: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying tags');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _attachRevisionHistroy: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying revision histories as attachment');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _createTargetCopy: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying items');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _getTargetModels: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Fetching target models');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _getSourceModels: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Fetching source models');

        gApp.setLoading(false);
        deferred.resolve(); //Dummy 
        
        return deferred.promise;
    },

    _mainAction: function(){

        var calls = [
            gApp._getTargetModels,
            gApp._getSourceModels,
            gApp._checkModelEquality,
            gApp._createTargetCopy
        ];

        var extendedCalls = [
            gApp._copyTags,
            gApp._attachRevisionHistroy,
            gApp._addDependencies    //Within the group we have and warn about external ones!
        ];

        if (gApp.getSetting('extendedCopy' === true)) {
            calls = calls.concat(extendedCalls);
        }

        Deft.Chain.sequence(
            calls, this).then({
            success: function() {
                debugger;
            },
            failure: function() {
                debugger;
            }
        });

        gApp.nodeTree.eachBefore( function(d) {
            console.log('This: ' + d.id, ', Parent: ' + (d.parent ? d.parent.id: 'null'));
        })

    },

    _topLevel: function(data) {

        gApp.setLoading('Fetching hierarchy');
        //d3.stratify needs a single top level item
        if (data.length >1) {
            gApp._nodes.push( {
            'Name': 'R0',
            'Parent': null,
            'Record': null,

            });
            gApp._nodes = gApp._nodes.concat(gApp._createNodes(data, 'R0'));

        }else {
            gApp._nodes = gApp._createNodes(data, null);
        }
        gApp._recurseLevel(data).then ({
            success: function() {
                gApp.setLoading(false);
                gApp.nodeTree = gApp._createTree(gApp._nodes);
                gApp._mainAction();
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
                gApp._nodes = gApp._nodes.concat(gApp._createNodes(records, record.get('FormattedID')))
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
                console.log('Nothing to do for type ' + type + ' for ' + record.get('FormattedID'));
                promise.resolve();
            }
        }
        else {
            console.log('Failed to load for record: ' + record.get('FormattedID'));
            promise.resolve();
        }
    },

    _getArtifacts: function(record) {

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
                    fetch: gApp.INITIAL_FETCH_LIST,
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('Children', record, records, success, childPromise);
                    },
                    filters: []
                };

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
                    fetch: gApp.INITIAL_FETCH_LIST,
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
                    fetch: gApp.INITIAL_FETCH_LIST,
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
                    fetch: gApp.INITIAL_FETCH_LIST,
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
                    fetch: gApp.INITIAL_FETCH_LIST,
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
                    fetch: gApp.INITIAL_FETCH_LIST,
                    callback: function(records, operation, success) {
                        gApp._processResult('TestCaseStep', record, records, success, testCaseStepPromise);
                    }
                };
                record.getCollection( 'TestCaseStep').load( testCaseStepConfig );
            }
                

            
        // });
        return promises;
    },

    _createNodes: function(data, parent) {
        //These need to be sorted into a hierarchy based on what we have. We are going to add 'other' nodes later
        var nodes = [];
        //Push them into an array we can reconfigure
        _.each(data, function(record) {
            nodes.push({
                'Name': record.get('FormattedID'), 
                'Parent': parent,
                'Record': record, 
            });
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
                        var retval = d.Name;
                        return retval;
                    })
                    .parentId( function(d) {
                        return d.Parent;
                    })
                    (nodes);
        return nodetree;
    },

    launch: function() {

    },
});
}());