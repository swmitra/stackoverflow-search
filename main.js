/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, browser: true */
/*global $, define, brackets, Mustache */

define(function (require, exports, module) {
    "use strict";

    var AppInit = brackets.getModule("utils/AppInit"),
        SearchTemplate = require("text!html/stack-exchange-search-template.html"),
        Strings = brackets.getModule("strings"),
        ModalBar = brackets.getModule("widgets/ModalBar").ModalBar,
        CommandManager = brackets.getModule("command/CommandManager"),
        Commands = brackets.getModule("command/Commands"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        Commands = brackets.getModule("command/Commands");
    
    var SEARCH_COMMAND = "show.stacksearch";
    
    var ClipBoardCopyButtonTemplate = "<button id='copy-to-editor' style='border:1px solid lightgray;border-radius:4px;-webkit-style:none;float:right;margin-top:-2px;color:white;'>Copy</button>";
    var ContentBodyTemplate = '<div class="se-search" id="search-content-body" style="-webkit-user-select: auto;height:calc(100% - 5px);width: calc(100% - 10px);background:white;overflow:auto;padding:4px;"></div>';
    var PaneHeaderTemplate = '{{header}}'
                            +'<a class ="close se-search" id="close-se-search" style="color:red;">×</a>'
                            +'<img class="close se-search" src="extensions/default/StackexchangeSearch/images/stackoverflow.png" id="open-se-in-browser" style="width:40px;height:20px;margin-right:10px;">';
    
    var SearchURL = 'https://api.stackexchange.com/2.2/search?order=desc&sort=activity&site=stackoverflow&answers=true&filter=withbody&key=DSONRG3bHBdQOMnrMZUIew((&intitle=';
    var AnswerURL = 'https://api.stackexchange.com/2.2/questions/{{id}}/answers?order=desc&site=stackoverflow&filter=withbody&answers=true&key=DSONRG3bHBdQOMnrMZUIew((';
    var CommentsURL = 'https://api.stackexchange.com/2.2/answers/{{id}}/comments?order=desc&sort=creation&site=stackoverflow&filter=withbody&key=DSONRG3bHBdQOMnrMZUIew((';
    
    var ExtensionUtils = brackets.getModule("utils/ExtensionUtils");
    
    require("lib/typeahead.jquery");
    require("lib/bloodhound");
    
    var headerContentBkp = null;

    function _toggleStackSearch(){
        //Launch the modal search bar for user input
        var modalBar = new ModalBar(SearchTemplate, true, true);
        
        // Instantiate the Typeahead UI
            $('#stack-search-input').typeahead(null, {
                displayKey: 'value',
                highlight:'true',
                source: hits.ttAdapter()
            });
            
            $('#stack-search-input').focus();
            
            //On a suggestion select show the question and answer details
            $('#stack-search-input').on(
                    'typeahead:selected',
                    function(event,object) {
                        modalBar.close();
                        CommandManager.execute(Commands.CMD_SPLITVIEW_VERTICAL)
                        .done(function () {
                            if($("#second-pane .pane-header .se-search").length === 0){
                                headerContentBkp = $("#second-pane .pane-header").html();
                            }
                            $("#second-pane .pane-content").children().hide();
                            $("#second-pane .not-editor").show();
                            $("#second-pane .not-editor").html(ContentBodyTemplate);
                            $("#second-pane .pane-header").html(PaneHeaderTemplate.split('{{header}}').join(object.value));                                     
                            $("#search-content-body").html("");
                            $("#search-content-body").append("<h4 class='question'>Question</h4>");
                            $("#search-content-body").append(object.content);
                            $("#search-content-body").focus();
                            var requestURL = AnswerURL.split("{{id}}").join(object.id);
                            var responseObj = null;
                            var xmlHttp = new XMLHttpRequest();
                            xmlHttp.onreadystatechange = function () {
                                if (xmlHttp.readyState === 4) {
                                    if (xmlHttp.responseText) {
                                        responseObj = JSON.parse(xmlHttp.responseText);
                                        $.each(responseObj.items, function( index, value ) {
                                        
                                          //fetch comments for this answer
                                            var commentURL = CommentsURL.split("{{id}}").join(value.answer_id);
                                            var commentsObj = null;
                                            var commentsHttp = new XMLHttpRequest();
                                            commentsHttp.onreadystatechange = function () {
                                                if (commentsHttp.readyState === 4) {
                                                    if(value.is_accepted){
                                                    $("#search-content-body").append("<h4 class='answer accepted'>Answer "+parseInt(index+1)+"<span class='close score'>"+value.score+"</span></h4>");
                                                  }else {
                                                      $("#search-content-body").append("<h4 class='answer'>Answer "+parseInt(index+1)+"<span class='close score'>"+value.score+"</span></h4>");
                                                  }
                                                  $("#search-content-body").append(value["body"]);
                                                    
                                                    //populate comments
                                                    if (commentsHttp.responseText) {
                                                        commentsObj = JSON.parse(commentsHttp.responseText);
                                                        $.each(commentsObj.items, function( index, value ) {
                                                          $("#search-content-body").append(value["body"]);
                                                        });
                                                    } 
                                                }
                                            };
                                            commentsHttp.open("GET", commentURL, true);
                                            commentsHttp.send(null);
                                        });
                                    } 
                                } 
                            };
                            xmlHttp.open("GET", requestURL, true);
                            xmlHttp.send(null);
                            
                            $(document).on('mouseenter',"#search-content-body pre",function(event){
                                $(this).find("#copy-to-editor").remove();
                                  $(this).prepend(ClipBoardCopyButtonTemplate);
                                  event.stopPropagation();
                              });

                              $(document).on('mouseleave',"#search-content-body pre",function(event){
                                  $(this).find("#copy-to-editor").remove();
                              });
                            
                            
                            $(document).on("click","#copy-to-editor",function(event){
                                var sel = window.getSelection();
                                if($(sel.anchorNode).parent()[0] != $(this).parent().find("code")[0]){
                                    sel.removeAllRanges();
                                    var range = document.createRange();
                                    range.selectNodeContents($(this).parent().find("code")[0]);
                                    sel.addRange(range);
                                }
                                document.execCommand('copy');
                                event.preventDefault();
                                event.stopPropagation();
                            });
                            
                            $("#open-se-in-browser").on('click',function(){
                                brackets.app.openLiveBrowser(object.link, false);
                            });
                            
                            $("#close-se-search").one('click',function(){
                                $(".se-search").remove();
                                $("#second-pane .pane-content").children().show();
                                $("#second-pane .not-editor").hide();
                                $("#second-pane .pane-header").html(headerContentBkp || "");
                            });
                        }); 
                });
    }
    

    // Instantiate the Bloodhound suggestion engine
    var hits = new Bloodhound({
        datumTokenizer: function (datum) {
            return Bloodhound.tokenizers.whitespace(datum.value);
        },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        remote: {
            url: SearchURL ,
            replace: function (url, query) {
                if ($('#stack-search-input').val()) {
                    url += encodeURIComponent($('#stack-search-input').val());
                }
                return url;
            },
            filter: function (hits) {
                // Map the remote source JSON array to a JavaScript object array
                return $.map(hits.items, function (hit) {
                    return {
                        value: hit.title,
                        id: hit.question_id,
                        link:hit.link,
                        content : hit.body
                    };
                });
            }
        }
    });

     AppInit.appReady(function () {
         //Register search command 
         CommandManager.register(SEARCH_COMMAND, SEARCH_COMMAND, _toggleStackSearch);
         KeyBindingManager.addBinding(SEARCH_COMMAND,"Shift-Cmd-Space");
         
    });
    
    //Load twitter typeahead stylesheet to style suggestions menu 
    ExtensionUtils.loadStyleSheet(module, "css/typeahead.css");
});