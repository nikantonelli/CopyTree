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
        'portfoliotemLevelUpper': {
            default: ['State', 'PortfolioItemType', 'Children'],
            extended: [],
            custom: []
        },

        'portfolioitemLevel1': {
            default: ['State', 'PortfolioItemType', 'UserStories'],
            extended: [],
            custom: []
        },

        'HierarchicalRequirement': {
            default: ['ScheduleState', 'Defects', 'Tasks', 'TestCases', 'Children'],
            extended: [],
            custom: []
        },

        'Defect': {
            default: ['State','Tasks', 'TestCases'],
            extended: [],
            custom: []
        },

        'Task': {
            default: ['State', 'ToDo'],
            extended: [],
            custom: []
        },

        'TestCase': {
            default: [],
            extended: ['Method', 'Objective','Package', 'PostConditions', 'PreConditions' ],
            custom: []
        },

        'TestCaseStep': {
            default: [],
            extended: ['ExpectedResult', 'Input' ],
            custom: []
        }
    },

        //The inital fields that help you decide on what items are important. When we come to do the copy
        //we will copy as many fields as we can depending on the type of artefact
        //We fetch Attachments, Tags, etc., so we can count them to give stats to the user.
        //The less data you ask for the quicker the initial search will be (network traffic)
    requiredFetchList:
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
                'PortfolioItemType',
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
            itemId: 'filterBox',
            layout: 'vbox'
        },{
            xtype: 'container',
            itemId: 'selectionBox',
            layout: 'hbox',
            listeners: {
                afterrender:  function() {  gApp = this.up('#rallyApp'); gApp._onElementValid(this);},
            }

        }
    ],

    _fieldFetchList: function(modelType){
        var fieldListName = '';
        
        //For portfolioitems, we need to know what ordinal we are (so as not to use hardcoded names in this program)
        //Luckily, the piType object has a store with all this in.
        if (modelType.toLowerCase().startsWith('portfolioitem/')){
            var ordinal = gApp.down('#piType').store.findRecord('TypePath', modelType).get('Ordinal');
            if (ordinal === 0){
                fieldListName = 'portfolioitemLevel1';
            }
            else {
                fieldListName = 'portfoliotemLevelUpper';
            }
        }
        else {
            fieldListName = modelType;
        }
        if ( gApp.getSetting('extendedCopy')) {
            return gApp.requiredFetchList.concat(gApp.fieldList[fieldListName].default
                .concat(gApp.fieldList[fieldListName].extended));
        }
        else {
            return gApp.requiredFetchList.concat(gApp.fieldList[fieldListName].default);
        }
    },

    timer: null,
    
    _resetTimer: function(callFunc) {
        if ( gApp.timer) { clearTimeout(gApp.timer);}
        gApp.timer = setTimeout(callFunc, 2000);    //Debounce user selections to the tune of two seconds
    },

    _nodeTree: null,

    //Entry point after creation of render box
    _onElementValid: function(rs) {
        gApp._addbits();
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
        var is = hdrBox.insert(1,{
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
                models: [ ptype.getRecord().get('TypePath').toLowerCase() ],
                fetch: gApp._fieldFetchList(ptype.getRecord().get('TypePath')),
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
                margin: '8 0 5 20',                           
                context: this.getContext(),
                height:30,
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

    _loadModels: function(models, workspace) {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModels({
            types: models,
            context: {
                workspace: Rally.util.Ref.getRelativeUri(workspace._ref)
            },
            success: function(models) {
                deferred.resolve(models);
            },
            failure: function(e) {
                deferred.reject(e);
            }
        })
        return deferred.promise;
    },

    _getTargetWorkspace: function() {
        debugger;
        return gApp.down('#penguin').projectRecord.get('Workspace');
    },

    //Assume we are coming from where we are to start with.....
    _getSourceWorkspace: function() {
        return gApp.getContext().getWorkspace(); 
    },

    sourceModelList: [],

    _scanForSourceModels: function () {
        return gApp.sourceModelList;
    },

    _scanForTargetModels: function () {
        // ##TODO, translate to target
        gApp.targetModelList = gApp.sourceModelList;

        return gApp.targetModelList;
    },

    _checkModelEquality: function(){
        var deferred = Ext.create('Deft.Deferred');

        var promises = [];
        
        Deft.Promise.all(promises).then({
            success: function() {
                //Give the user a modal that shows issues and  asks if you want to continue. If not, reject the deferred
                deferred.resolve();
            },
            failure: function(e) {
                deferred.reject(e);
            }
        })

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

        var targetModelList = gApp._scanForTargetModels();
        var targetWKS = gApp._getTargetWorkspace();
        gApp._loadModels(targetModelList, targetWKS).then({
            success: function(models) {
                gApp.targetModels = models;
                gApp.setLoading(false);
                deferred.resolve(); //Dummy 
            },
            failure: function(e) {
                console.log('Could not fetch target models: ', e);
                deferred.reject(e);
            }
        });

        return deferred.promise;
    },

    _getSourceModels: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Fetching source models');

        gApp._loadModels(
            gApp._scanForSourceModels(), 
            gApp._getSourceWorkspace())
        .then({
            success: function(models) {
                gApp.sourceModels = models;
                gApp.setLoading(false);
                deferred.resolve(models); 
            },
            failure: function(e) {
                console.log('Could not fetch source models: ', e);
                deferred.reject(e);
            }
        });
        return deferred.promise;
    },

    _mainAction: function(){

        var calls = [
            gApp._getSourceModels,  //Get list of models we found in the tree
            gApp._getTargetModels,  //Then translate this into what might be on the destination (i.e. portfolio item types)
            gApp._checkModelEquality,   //Check whether the fields exist on both ends for all the models
        ];

        Deft.Chain.sequence(
            calls, this).then({
            success: function() {
                gApp._secondAction().then({
                    success: function() {
                        Rally.ui.notify.Notifier.show({message: 'Copy complete'});
                    },
                    failure: function(e) {
                        Rally.ui.notify.Notifier.showError({message: 'Copy failed'});
                        console.log(e);
                    }
                });
            },
            failure: function() {
                Rally.ui.notify.Notifier.showWarning({message: 'Copy exiting (Tests Failed)'});
            }
        });
    },
    
    _secondAction: function(data) {

        var calls = [
            gApp._createTargetCopy
        ];

        var extendedCalls = [
            gApp._copyTags,
            gApp._attachRevisionHistroy,
            gApp._addDependencies    //Within the group we have and warn about external ones!
        ];

        if (gApp.getSetting('extendedCopy') === true) {
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
    },

    _topLevel: function(data) {

        gApp.setLoading('Fetching hierarchy');
        gApp.hierarchyStatusMessage = {};
        //d3.stratify needs a single top level item
        if (data.length >1) {
            gApp._nodes.push( {
            'Name': 'R0',
            'Parent': null,
            'Record': null,
            'Target': null

            });
            gApp._nodes = gApp._nodes.concat(gApp._createNodes(data, 'R0'));

        }else {
            gApp._nodes = gApp._createNodes(data, null);
        }
        gApp._recurseLevel(data).then ({
            success: function() {
                gApp.setLoading(false);
                gApp._nodeTree = gApp._createTree(gApp._nodes);
                gApp.down('#penguin').enable();
//                gApp._mainAction();
            }
        });
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
            console.log('Nothing to do for ', _.pluck(data, 
                function(item) {
                    return item.get('FormattedID') + ' ';
                }
                                                    )
            );
            deferred.resolve();
        }

        return deferred.promise;
    },

    hierarchyStatusMessage: {},

    _stringIt: function(obj) {
        var str = '';
        for (var p in obj) {
            if (obj.hasOwnProperty(p)) {
                str += p + ': ' + obj[p] + '\n';
            }
        }
        return str;
    },

    _updateHierarchyStatus(type, count) {

        if ( ! gApp.hierarchyStatusMessage.hasOwnProperty(type)){
            gApp.hierarchyStatusMessage[type] = 0;
        }
        gApp.hierarchyStatusMessage[type] += count;
        return gApp._stringIt(gApp.hierarchyStatusMessage);
    },

    _processResult: function (type, record, records, success, promise) {
        if (success) {
            if (records && records.length)  {
                gApp._nodes = gApp._nodes.concat(gApp._createNodes(records, record.get('FormattedID')));
                console.log('Recursing for record: ' + record.get('FormattedID'));
                gApp._recurseLevel(records).then ({
                    success: function() {
                        console.log('Completed ' + type + ' recurse for record: ' + record.get('FormattedID'));
                        promise.resolve();
                    },
                    failure: function() {
                        console.log('Failed to complete recurse for ' + record.get('FormattedID'));
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
        gApp.down('#statusText').setValue(gApp._updateHierarchyStatus(record.get('_type'),1));
        if ( ! gApp.sourceModelList.includes(record.get('_type'))) {
            gApp.sourceModelList.push( record.get('_type'));
        }

        var promises = [];

            //The lowest level portfolio item type has 'UserStories' not 'Children'
            if (record.hasField('Children') && record.get('Children').Count){ 
                var childPromise = Ext.create('Deft.Deferred');
                promises.push(childPromise.promise);
                var childrenConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    //Need to identify the child type to determine what fields we want.
                    fetch: gApp._fieldFetchList(record.get('Children')._type),
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

            if (record.hasField('UserStories') && record.get('UserStories').Count){  
                var usPromise = Ext.create('Deft.Deferred');
                promises.push(usPromise.promise);

                var UserStoriesConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    fetch: gApp._fieldFetchList(record.get('UserStories')._type),
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('UserStories', record, records, success, usPromise);
                    
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

            if (record.hasField('Defects') && record.get('Defects').Count){ 
                var defectPromise = Ext.create('Deft.Deferred');
                promises.push(defectPromise.promise);

                var defectsConfig = {
                    sorters: [
                        {
                            property: 'DragAndDropRank',
                            direction: 'ASC'
                        }
                    ],
                    fetch: gApp._fieldFetchList(record.get('Defects')._type),
                    callback: function(records, operation, success) {
                        //Start the recursive trawl down through the levels
                        gApp._processResult('Defects', record, records, success, defectPromise);
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

            if (record.hasField('Tasks') && record.get('Tasks').Count){ 
                //We are Defects or UserStories when we come here
                var taskPromise = Ext.create('Deft.Deferred');
                promises.push(taskPromise.promise);
                var taskConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp._fieldFetchList(record.get('Tasks')._type),
                    callback: function(records, operation, success) {
                        gApp._processResult('Tasks', record, records, success, taskPromise);
                    }
                };
                record.getCollection( 'Tasks').load( taskConfig );
            }

            if (record.hasField('TestCases') && record.get('TestCases').Count){ 
                //Now create a new config for Test Cases 
                var testCasePromise = Ext.create('Deft.Deferred');
                promises.push(testCasePromise.promise);
                var testCaseConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp._fieldFetchList(record.get('TestCases')._type),
                    callback: function(records, operation, success) {
                        gApp._processResult('TestCases', record, records, success, testCasePromise);
                    }
                };
                record.getCollection( 'TestCases').load( testCaseConfig );
            }

            if (record.hasField('Steps') && record.get('Steps').Count){ 
                //Now create a new config for testcasesteps 
                var testCaseStepPromise = Ext.create('Deft.Deferred');
                promises.push(testCaseStepPromise.promise);

                var testCaseStepConfig = {
                    sorters: [{
                        property: 'DragAndDropRank',
                        direction: 'ASC'  
                    }],
                    fetch: gApp._fieldFetchList(record.get('Steps')._type),
                    callback: function(records, operation, success) {
                        gApp._processResult('TestCaseSteps', record, records, success, testCaseStepPromise);
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
                'Target': null      //When we copy, this will be populated.
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

    _addbits: function() {
        var targetSelector = Ext.create('Rally.ui.picker.project.ProjectPicker',
        {
            margin: '10 0 5 20',
            id: 'penguin',
            fieldLabel: 'Choose Target  ',
            topLevelStoreConfig: {
                fetch: ['Name', 'Workspace']
            },
            listeners: {
                select: function () {
                    gApp._mainAction();
                }
            },
            disabled: true  //Need to be disabled until we have some data to work on.
        });
        gApp.down('#selectionBox').add(targetSelector);

        var statusText = Ext.create('Ext.form.field.TextArea', {
            margin: '10 0 5 20',
            fieldLabel: 'Status',
            id: 'statusText',
            grow: true,
            width: 600,
            readOnly: true,
            border: 0    
        });
        gApp.down('#selectionBox').add(statusText);

    },
});
}());