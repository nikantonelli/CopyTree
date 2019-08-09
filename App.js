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
            extendedCopy: true
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

    // Defaults are those used to decide on the tree and the basic fields you want over
    // Extended are all those that get copied with extendedCopy set
    //##TODO Custom fields will be used to do a mapping
    copyFields: {
        'portfoliotemLevelUpper': {
            default: ['State', 'PreliminaryEstimate' ],
            extended: [],
            custom: []
        },

        'portfolioitemLevel0': {
            default: ['State', 'PreliminaryEstimate'],
            extended: [],
            custom: []
        },

        'HierarchicalRequirement': {
            default: ['ScheduleState', 'PlanEstimate', ],
            extended: [],
            custom: []
        },

        'Defect': {
            default: ['State'],
            extended: [],
            custom: []
        },

        'Task': {
            default: ['State', 'ToDo'],
            extended: [],
            custom: []
        },

        'TestCase': {
            default: ['Method', 'Type'],
            extended: ['Objective', 'Package', 'PostConditions', 'PreConditions'],
            custom: []
        },

        'TestCaseStep': {
            default: ['ExpectedResult', 'Input' ],
            extended: [],
            custom: []
        }
    },

    copyCommon: {
        default: ['Name'],   //Project will be overwritten for the target, but fetched below for the source
        extended: ['Notes', 'Ready', 'Description', 'Owner'],
        custom: []
    },

        //The inital fields that help you decide on what items are important. When we come to do the copy
        //we will copy as many fields as we can depending on the type of artefact above
        //We fetch Attachments, Tags, etc., so we can count them to give stats to the user.
        //The less data you ask for the quicker the initial search will be (network traffic), but you need to fethc everything above 
        //in the list below
    decisionFields:
    [
        'Attachments',
        'Children',
//                'CreationDate',
        'Description',
//                'DisplayColor',
//                'DragAndDropRank',
        'ExpectedResult',
        'FormattedID',
//                'Iteration',
//                'Milestones',
        'Defects',
        'Input',
        'Method',
        'Name',
        'Notes',        //We are going to add the new/old formattedID in the notes
        'Objective',
        'ObjectID',
        'OrderIndex', 
        'Ordinal',
        'Owner',
        'Package',
//                'Parent',
//                'PercentDoneByStoryCount',
//                'PercentDoneByStoryPlanEstimate',
        'PortfolioItemType',
        'PostCOnditions',
        'PreConditions',
//                'Predecessors',
        'PredecessorsAndSuccessors',
        'PreliminaryEstimate',
        'Project',
        'Ready',
//                'Release',
        'RevisionHistory',
        'ScheduleState',
//                'Successors',
        'Tags',
        'Tasks',
        'TestCases',
        'ToDo',
        'Type',
        'UserStories',
        'Workspace',

        //Customer specific after here. Delete as appropriate
        // 'c_ProjectIDOBN',
        // 'c_QRWP',
        // 'c_ProgressUpdate',
        // 'c_RAIDSeverityCriticality',
        // 'c_RISKProbabilityLevel',
        // 'c_RAIDRequestStatus'   
    ],

    modelMaps: {},

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

    _copyFieldList: function(modelType){
        var fieldListName = '';
        
        //For portfolioitems, we need to know what ordinal we are (so as not to use hardcoded names in this program)
        //Luckily, the piType object has a store with all this in.
        if (modelType.toLowerCase().startsWith('portfolioitem/')){
            var ordinal = gApp.down('#piType').store.findRecord('TypePath', modelType).get('Ordinal');
            if (ordinal === 0){
                fieldListName = 'portfolioitemLevel0';
            }
            else {
                fieldListName = 'portfoliotemLevelUpper';
            }
        }
        else {
            fieldListName = modelType;
        }
        if ( gApp.getSetting('extendedCopy')) {
            return gApp.copyCommon.extended.concat(gApp.copyCommon.default.concat(gApp.copyFields[fieldListName].default
                .concat(gApp.copyFields[fieldListName].extended)));
        }
        else {
            return gApp.copyCommon.default.concat(gApp.copyFields[fieldListName].default);
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
                    fieldLabel: '1: Choose Portfolio Type :',
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
                        select: function() { 
                            gApp.sourceTypeStore = this.store;
                            gApp._kickOff();},    //Jump off here to add portfolio size selector
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
            fieldLabel: '2: Choose Start Item :',
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
                fetch: gApp.decisionFields,
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

    _loadModels: function(models, workspace, project) {
        var deferred = Ext.create('Deft.Deferred');
        var context = {
            workspace: Rally.util.Ref.getRelativeUri(workspace._ref),
            project: null
        };
        if (project !== null) {
            context.project = Rally.util.Ref.getRelativeUri(project._ref);
        }
        Rally.data.ModelFactory.getModels({
            types: models,
            context: context,
            success: function(models) {
                deferred.resolve(models);
            },
            failure: function(e) {
                deferred.reject(e);
            }
        });
        return deferred.promise;
    },

    _getTargetWorkspace: function() {
        return gApp.down('#penguin').projectRecord.get('Workspace');
    },

    _getTargetProject: function() {
        return gApp.down('#penguin').projectRecord.raw;
    },

    //Assume we are coming from where we are to start with.....
    _getSourceWorkspace: function() {
        return gApp.getContext().getWorkspace(); 
    },

    _getSourceProject: function() {
        return gApp.getContext().getProject(); 
    },

    sourceModelList: [],

    _scanForSourceModels: function () {
        return gApp.sourceModelList;
    },

    _scanForTargetModels: function () {

        //We can fetch all the models in the target portfolio heirarchy and then add the non-portfolio ones from the source list
        gApp.targetModelList = _.pluck(gApp.targetTypeStore.getRecords(), function(piType) {
            return piType.get('TypePath');
        });
        gApp.targetModelList = gApp.targetModelList.concat( _.filter(gApp.sourceModelList, function(model) {
            return !(model.toLowerCase().startsWith('portfolioitem'));
        }));
        return gApp.targetModelList;
    },

    _checkModelEquality: function(){

        var deferred = Ext.create('Deft.Deferred');
        // Check whether the models are compatible
        // If not, pop-up a modal to ask the user if they want to do the most possible or cancel

        //for each model in the source, if it is a portfolioitem, then get the ordinal and compare against the target
        //with the same ordinal. For all the fields listed for this model, see if there is equivalence

        var results = {
            errorCount: 0,
            modelMaps: {},
            fatalErrors: {
                errorCount: 0,
                incompatibleFieldTypes : [],
                requiredFieldsMissing: []
            },
            recoverableErrors: {
                errorCount: 0,
                incompatibleFieldValues : {}
            }
        };
        var testFieldConfig = [];

        _.each(gApp.sourceModels, function(sourceModel) {
            console.log('Checking: ' + sourceModel.prettyTypeName);
            //If the model is portfolio, then find the model in the sourceTypeStore and get the ordinal
            var ordinal = null;
            var targetType = null;
            var targetModel = null;
            _.find(gApp.sourceTypeStore.getRecords(), function(type) {
                if (type.get('TypePath').toLowerCase() === sourceModel.prettyTypeName) {
                    ordinal = type.get('Ordinal');
                    return true;
                }
                return false;
            });

            testFieldConfig = gApp._copyFieldList( sourceModel.typeDefinition._refObjectName);
            if ( ordinal === null) {
                //We are not a portfolioitem here, so we are identical names
                targetType = sourceModel.typeDefinition._refObjectName;
            }
            else {
                //we are a portfolioitem 
                //Find the equivalent model in the target based on the ordinal
                targetType = _.find(gApp.targetTypeStore.getRecords(), function(type) {
                    if (type.get('Ordinal') === ordinal) {
                        return true;
                    }
                    return false;
                }).get('TypePath');
            }
            targetModel = gApp.targetModels[targetType];
            gApp.modelMaps[sourceModel.typeDefinition._refObjectName] = targetModel.typeDefinition._refObjectName;
            var testFields = testFieldConfig.default;
            //We should now have the source model, the destination model, the typestores (for the ordinal)
            //Now run through the fields of interest (testFields) and check for compatibility


            //Check all the fields to see if they are the same type. Each 'constrained' one, check for AllowedValues equivalence
            _.each(testFields, function(fieldname) {
                var sourceField = sourceModel.getField(fieldname);                
                var targetField = targetModel.getField(fieldname);

                if (( targetField === undefined) ||
                    ( sourceField.attributeDefinition.AttributeType != targetField.attributeDefinition.AttributeType) ||
                    ( sourceField.attributeDefinition.Constrained != targetField.attributeDefinition.Constrained))
                {
                    results.fatalErrors.incompatibleFieldTypes.push(fieldname);
                    results.errorCount += 1;
                    results.fatalErrors.errorCount += 1;
                    return;
                }
                // Both are the same, so let's check for values
                if (sourceField.attributeDefinition.Constrained === true)
                {
                    var missingValues = [];
                    _.each( sourceField.attributeDefinition.AllowedValues, function( sourceAllowedValue) {
                        if ( ! _.find(targetField.attributeDefinition.AllowedValues, function(targetAllowedValue){
                                return sourceAllowedValue.StringValue === targetAllowedValue.StringValue;

                        })) {
                            missingValues.push(sourceAllowedValue.StringValue);
                        }
                    });
                    if (missingValues.length > 0) {
                        var fObj = {};
                        var sObj = {};

                        sObj[fieldname] = {
                            'missing': missingValues,
                            'in' : gApp._getTargetWorkspace().Name,
                            'type' : targetModel.prettyTypeName,
                        };
                        fObj[sourceModel.elementName] = sObj;
                        Ext.merge( results.recoverableErrors.incompatibleFieldValues, fObj);
                        results.errorCount += 1;
                        results.recoverableErrors.errorCount += 1;
                    }
                }
            });
        });

        results.modelMaps = gApp.modelMaps;

        //We need to check for required fields in target and see if they are not 
        //in the requested field list
        //##TODO

        //Get the target models, look through for required fields and then check they are in the fieldList for that type
        _.each(gApp.targetModels, function(model) {
            var sourceType = _.invert(gApp.modelMaps)[model.typeName];
            //If we are trying to transfer that type, then get the source type fieldlist
            if (sourceType !== undefined) {
                var wantedFields = gApp._copyFieldList(sourceType);
                _.each( model.getFields(), function (modelField) {
                    if (( modelField.hidden === false) &&
                        ( modelField.required === true) && 
                        ( modelField.readOnly === false) &&
                        ( -1 === wantedFields.indexOf(modelField.name))
                        ) {
                            results.errorCount += 1;
                            results.fatalErrors.errorCount += 1;
                            results.fatalErrors.requiredFieldsMissing.push(
                                {
                                    'type' : model.typeDefinition._refObjectName,
                                    'field' : modelField.displayName
                                }
                            );
                    }
                });
            }
        });

        var resultsString = JSON.stringify(results, undefined, 4);
        console.log('ModelChecks: ' + resultsString);
        //If we have any problems, ask the user what to do
        if (results.errorCount > 0) {
            var titleString = 'Checks Failed. ';
            if (results.fatalErrors.errorCount === 0) {
                titleString += 'Ignore and copy?';
            } else {
                titleString += 'Required Fields Missing';
            }

            //Checks failed, so confirm ignore errors
            Ext.create('Rally.ui.dialog.Dialog', {
                title: titleString,
                width: 300,
                height: 65,
                shadow: false,
                draggable: true,
                autoShow: true,
                closable: true,
                layout: 'hbox',
                items: [
                    {
                        xtype: 'rallybutton',
                        text: 'OK',
                        width: '33%',
                        disabled: (results.fatalErrors.errorCount > 0),
                        handler: function() {
                            // ##TODO Update the field list to remove those we had errors for.
                            
                            // !! We do not need to check for AllowedValues on target fields as we will be given a valid value
                            // when the ModelFactory gives it to us. We just remove the field from the list and leave the value alone.

                            deferred.resolve(results);
                            this.ownerCt.destroy();
                        }
                    },{
                        xtype: 'rallybutton',
                        text: 'View',
                        width: '33%',
                        handler: function() {
                            // Give them a file with the json variant of stuff
                            window.open(window.URL.createObjectURL(new Blob([resultsString], {type: 'text/json'})), '_blank');
                        }
                    },
                    {
                        xtype: 'rallybutton',
                        text: 'Cancel',
                        width: '33%',
                        handler: function() {
                            deferred.reject(results);
                            this.ownerCt.destroy();
                        }
                    }


                ]
            });

        }
        else {
            //Checks passed, so confirm and resolve the promise and continue
            Ext.create('Rally.ui.dialog.Dialog', {
                title: 'Checks passed. Start copy?',
                width: 300,
                height: 65,
                shadow: false,
                draggable: true,
                autoShow: true,
                closable: true,
                layout: 'hbox',
                items: [
                    {
                        xtype: 'rallybutton',
                        text: 'Yes',
                        width: '50%',
                        handler: function() {
                            deferred.resolve(results);
                            this.ownerCt.destroy();
                        }
                    },
                    {
                        xtype: 'rallybutton',
                        text: 'Cancel',
                        width: '50%',
                        handler: function() {
                            deferred.reject(results);
                            this.ownerCt.destroy();
                        }
                    }


                ]
            });
        }

        return deferred.promise;
    },

    _addDependencies: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying dependencies');

        gApp.setLoading(false);
        deferred.resolve('addDeps'); //Dummy 
        
        return deferred.promise;
    },

    _copyTags: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Copying tags');

        //Collate all the tags in the source system
        var tags = [];
        gApp._nodeTree.each( function(node) {
            if ( node.data.sourceRecord.get('Tags').Count > 0) {

                _.each(node.data.sourceRecord.get('Tags')._tagsNameArray, function (tag) {
                    tags.push(tag);
                });
            }
        });

        //Now check if they exist in the target (which might be the same as the source, so check the workspace IDs!)
        //In a large organisation there can be many thousands of tags in the target already. We can't easily check for
        //those that aren't present,so we will just try to create all the ones we want and ignore any errors. 
        //TODO: If we require thousands to be added, we are going to swamp the system with requests and this might need to be 
        //changed so that we (multithread?) control the number.

        if ( gApp._getSourceWorkspace().ObjectID !== gApp._getTargetWorkspace().ObjectID ) {
            var tagStore = Ext.create('Rally.data.wsapi.Store', {
                model: 'Tag',
                fetch: true,
                autoLoad: true,
                listeners: {
                    load: function(store, records) {
                        _.each(tags, function(tag) {
                            var msg = { 
                                Name: tag.Name
                            };
                            store.add(msg);                    
                        });
                        store.sync().then ({
                            success: function() {
                                //Now add tags to the items themselves
                                gApp._nodeTree.each( function(node) {
                                    var sourceTagStore = node.data.sourceRecord.getCollection('Tags');
                                    sourceTagStore.load({
                                        callback: function() {
                                            targetTagStore = node.data.targetRecord.getCollection('Tags');
                                            targetTagStore.load({
                                                callback: function() {
                                                    _.each(sourceTagStore.getRecords(), function(sourceTagRecord) {
                                                        targetTagStore.add({Name: sourceTagRecord.get('Name')});
                                                    });
                                                    targetTagStore.sync();
                                                }
                                            });
                                        }
                                    });
                                });
                                //resolve even though the saving is ongoing....
                                deferred.resolve('copyTags');
                            }
                        }).always ( function() {
                            gApp.setLoading(false);
                        });            
                    }
                }
            });
        }
        return deferred.promise;
    },

    _attachRevisionHistory: function(){
        //We should now have the source and target records created, so we can just
        // move the attachments if in the same workspace, or copy if in a different one.
        // For now, we will copy all.

        var deferred = Ext.create('Deft.Deferred');

        gApp.setLoading('Copying revision histories as attachments');

        gApp._nodeTree.each( function(node) {
                var revHistory = node.data.sourceRecord.get('RevisionHistory');
                var sourceStore = Ext.create('Rally.data.wsapi.Store', {
                    model: 'Revision',
                    filters: [
                        {
                            property: 'RevisionHistory',
                            value: revHistory._ref
                        }
                    ],
                    sorters: [
                        {
                            property: 'CreationDate',
                            direction: 'DESC'
                        }
                    ]
                });
                sourceStore.load({
                    callback: function(records, operation, success) {
                        if (success) {
                            var revisionText = '';
                            _.each(records, function(record) {
                                var shortDate = Ext.Date.format(record.get('CreationDate'),'d-M-Y H:i:s');
                                revisionText = revisionText + gApp._fixedStringLength(shortDate, 25) + ' ' +
                                    gApp._fixedStringLength(record.get('User')._refObjectName, 25) + ' ' +
                                    record.get('Description') +
                                    '\n';
                            });
                            var targetStore = node.data.targetRecord.getCollection('Attachments');
                            targetStore.load({
                                callback: function() {
                                    _.each(sourceStore.getRecords(), function(attachment) {
debugger;
                                    });
                                }
                            });
                        }
                    }
                });
        });

        gApp.setLoading(false);
        deferred.resolve('attachRevisionHistory'); //Dummy 
        
        return deferred.promise;
    },

    _fixedStringLength: function(inStr, length) {
        var spaces = ' '.repeat(length);
        var outStr = inStr.substring(0, length);
        return outStr + spaces.substring(0, length - outStr.length);
    },

    _createTargetCopy: function(){
        var deferred = Ext.create('Deft.Deferred');
        Rally.ui.notify.Notifier.show({message:'Setting items copying'});

        //Get all the nodes in the hierarchy
        //Have to save the parent and then do the children
        gApp._nodeTree.eachBefore( function(node) {
            gApp._nodesToSave.push(node);
        });

        gApp._saveChildren().then({
            success: function() {
                deferred.resolve('saveChildrenDone');
            }
        });
        return deferred;
    },
    _saveRecordOnNode: function(node) {
        var deferred = Ext.create('Deft.Deferred');
        gApp._saveRecord(node).then({
            success: function() {
                if (gApp._nodesToSave.length) {
                    gApp._saveRecordOnNode(gApp._nodesToSave.shift()).then( {
                        success: function() {
                            deferred.resolve('saveRecordOnNode');
                        }
                    });
                }
                else {
                    deferred.resolve('noRecordsLeft');
                }
            }
        });
        return deferred.promise;
    },

    _saveChildren: function() {
        var deferred = Ext.create('Deft.Deferred');
        if (gApp._nodesToSave.length) {
            gApp._saveRecordOnNode(gApp._nodesToSave.shift()).then( {
                success: function() {
                    deferred.resolve('savedChildren');
                }
            });
        }
        else {
            deferred.resolve('saveChildren');
        }


        // var promises = [];
        // _.each(node.children, function(child) {
        //     promises.push( gApp._saveRecord(child));
        // });

        // Deft.Promise.all(promises).then({
        //     success: function() {
        //         _.each(node.children, function(child) {
        //             gApp._saveChildren(child).then({
        //                 success: function() {
        //                     deferred.resolve();
        //                 }
        //             });
        //         });
        //     }
        // });
        return deferred.promise;
    },

    _nodesToSave: [],

    _saveRecord: function(node) {
        var deferred = Ext.create('Deft.Deferred');
        //Create a target model instance and connect it to this nodes data
        var sourceType = node.data.sourceRecord.raw._type;
        var modelMapped = gApp.modelMaps[sourceType];
        var targetModel = gApp.targetModels[modelMapped];
        var fieldConfig = {};
        var data = {};
        _.each( gApp._copyFieldList(sourceType), function(fieldName) {
                data[fieldName] = node.data.sourceRecord.get(fieldName);
        });
        console.log(node.data.Name, data);
        fieldConfig.fetch = true;
        fieldConfig.Project = Rally.util.Ref.getRelativeUri(gApp._getTargetProject());
        fieldConfig.Name = node.data.sourceRecord.get('Name');

        fieldConfig.Notes = '<div>Created from ' + node.data.sourceRecord.get('FormattedID') + 
                        ' ( ' + gApp._getSourceWorkspace().Name + ' ) </div>' + (fieldConfig.Notes?fieldConfig.Notes:'');

        gApp._setParentage(fieldConfig, node);
        node.data.targetRecord = Ext.create(targetModel, Ext.clone(fieldConfig));
        node.data.targetRecord.save().then({
            success: function(savedRecord) {
                node.data.targetRecord = savedRecord;
                gApp._updateHierarchyStatus(sourceType.toLowerCase(), -1);
                console.log('Saved ' + node.data.sourceRecord.get('FormattedID') + ' to ' + node.data.targetRecord.get('FormattedID'));
                //Reload the parent for concurrency resolution
                if ( node.parent !== null) { 
                    node.parent.data.targetRecord.self.load(  node.parent.data.targetRecord.get('ObjectID'), {
                        fetch: true,
                        callback: function(record, operation) {
                            if (operation.wasSuccessful()) {
                                node.parent.data.targetRecord = record;
                                deferred.resolve(savedRecord);
                            }
                            else {
                                deferred.reject();    
                            }
                        }
                    });
                } else {
                    node.data.targetRecord = savedRecord;
                    deferred.resolve(savedRecord);
                }
            },
            failure: function(e) {
                var msg = 'Failed to save copy of ' ;
                console.log(msg, node.data.targetRecord, e);
                deferred.reject(node.data.sourceRecord);
            }
        });            
        return deferred.promise;
    },

    _setParentage: function(fieldConfig, node) {
        //If the node has a true Rally parent, then add the ref to the fieldConfig
        //Check the type of the record, so we know what its parent field is
        if (node.parent === null) { return; }   //If we are top of the tree, then we do nothing

        var parentField = '';
        var source = node.data.sourceRecord;
        if ( source ) {
            if ( source.isPortfolioItem()) {
                parentField = 'Parent';
            }
            else if ( source.isUserStory()) {
                parentField = 'PortfolioItem';
            }
            else if ( source.isDefect()) {
                parentField = 'Requirement';
            }
            else if ( source.isTask()) {
                parentField = 'WorkProduct';
            }
            else if ( source.isTestCase()) {
                parentField = 'WorkProduct';
            }

        }
        if (parentField !== '') {
            fieldConfig[parentField] = node.parent.data.targetRecord.get('_ref');
        }
    },

    _getTargetModels: function(){
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Fetching target models');

        var targetModelList = gApp._scanForTargetModels();
        var targetWKS = gApp._getTargetWorkspace();
        var targetProj = gApp._getTargetProject();

        gApp._loadModels(targetModelList, targetWKS, targetProj).then({
            success: function(models) {
                gApp.targetModels = models;
                gApp.setLoading(false);
                deferred.resolve('loadMNodels'); 
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
            gApp._getSourceWorkspace(),
            null)
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

    _loadTargetPortfolioTypes: function() {
        var deferred = Ext.create('Deft.Deferred');
        gApp.setLoading('Fetching Target Portfolio Types');
        gApp.targetTypeStore = Ext.create('Rally.data.wsapi.Store', {
            context: {
                workspace: gApp._getTargetWorkspace()._ref,
                project: null,
                projectScopeUp: false,
                projectScopeDown: false
            },
            autoLoad: true,
            remoteFilter: true,
            model: Ext.identityFn('TypeDefinition'),
            sorters: {
                property: 'Ordinal',
                direction: 'Desc'
            },
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            listeners : {
                load: function() {
                    deferred.resolve('loadTargetTypes');
                }
            }
        });

        return deferred.promise;
    },

    _mainAction: function(){

        var calls = [
            gApp._getSourceModels,  //Get list of models we found in the tree
            gApp._loadTargetPortfolioTypes,
            gApp._getTargetModels,  //Then translate this into what might be on the destination (i.e. portfolio item types)
            gApp._checkModelEquality,   //Check whether the fields exist on both ends for all the models
        ];

        Deft.Chain.sequence(
            calls, this).then({
            success: function() {
                gApp._secondAction().then({
                    success: function() {
                        // NOTE: because of the way the promises are structured, we get an OK aftet the top level one is saved
                        // TODO: make this so that it gives a complete signal after all are done.

//                        Rally.ui.notify.Notifier.show({message: 'Copy complete'});
                    },
                    failure: function(e) {
//                        Rally.ui.notify.Notifier.showError({message: 'Copy failed'});
                    }
                });
            },
            failure: function() {
                Rally.ui.notify.Notifier.showWarning({message: 'Copy exiting (Data check abort)'});
            }
        });
    },
    
    _secondAction: function(data) {

        var deferred = Ext.create('Deft.Deferred');
        var calls = [
            gApp._createTargetCopy
        ];

        var extendedCalls = [
            gApp._copyTags,
            gApp._attachRevisionHistory,
            gApp._addDependencies    //Within the group we have and warn about external ones!
        ];

        if (gApp.getSetting('extendedCopy') === true) {
            calls = calls.concat(extendedCalls);
        }

        Deft.Chain.sequence(
            calls, this).then({
            success: function() {
                deferred.resolve('Chain');
            },
            failure: function() {
                deferred.reject();
            }
        });
        return deferred.promise;
    },

    _topLevel: function(data) {

        gApp.setLoading('Fetching hierarchy');
        gApp.hierarchyStatusMessage = {};
        //d3.stratify needs a single top level item
        if (data.length >1) {
            gApp._nodes.push( {
            'Name': 'R0',
            'Parent': null,
            'sourceRecord': null,
            'targetRecord': null,
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
            Deft.Promise.all(promises).then({
                success: function() {
                    deferred.resolve('allPromises');
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
            deferred.resolve('noPromises');
        }

        return deferred.promise;
    },

    hierarchyStatusMessage: {},

    // _stringIt: function(obj) {
    //     var str = '';
    //     for (var p in obj) {
    //         if (obj.hasOwnProperty(p)) {
    //             str += p + ': ' + obj[p] + '\n';
    //         }
    //     }
    //     return str;
    // },

    _updateHierarchyStatus: function(type, count) {

        if ( ! gApp.hierarchyStatusMessage.hasOwnProperty(type)){
            gApp.hierarchyStatusMessage[type] = 0;
        }
        gApp.hierarchyStatusMessage[type] += count;
        gApp.down('#statusText').setValue(JSON.stringify(gApp.hierarchyStatusMessage, undefined, 3));
    },

    _processResult: function (type, record, records, success, promise) {
        if (success) {
            if (records && records.length)  {
                gApp._nodes = gApp._nodes.concat(gApp._createNodes(records, record.get('FormattedID')));
                console.log('Recursing for record: ' + record.get('FormattedID'));
                gApp._recurseLevel(records).then ({
                    success: function() {
                        console.log('Completed ' + type + ' recurse for record: ' + record.get('FormattedID'));
                    },
                    failure: function() {
                        console.log('Failed to complete recurse for ' + record.get('FormattedID'));
                    }
                }).always (
                    function() {
                        promise.resolve('doneRecurse');
                    }
                );
            }
            else {
                console.log('Nothing to do for type ' + type + ' for ' + record.get('FormattedID'));
                promise.resolve('doneRecord');
            }
        }
        else {
            console.log('Failed to load for record: ' + record.get('FormattedID'));
            promise.resolve('failedRecord');
        }
    },

    _getArtifacts: function(record) {

        console.log('Adding: ' + record.get('FormattedID'));
        gApp._updateHierarchyStatus(record.get('_type'),1);
        if ( ! gApp.sourceModelList.includes(record.raw._type)) {
            gApp.sourceModelList.push( record.raw._type);
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
                    fetch: gApp.decisionFields,
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
                    fetch: gApp.decisionFields,
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
                    fetch: gApp.decisionFields,
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
                    fetch: gApp.decisionFields,
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
                    fetch: gApp.decisionFields,
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
                    fetch: gApp.decisionFields,
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
                'sourceRecord': record, 
                'targetRecord': null //When we copy, this will be populated.
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
            fieldLabel: '3: Choose Target  ',
            topLevelStoreConfig: {
                fetch: ['Name', 'Workspace', 'Project']
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