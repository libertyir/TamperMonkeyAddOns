(function (Framework) {
    "use strict";
    class PlainTextViewerModule extends Framework.BaseModule {
        static id="PlainTextViewerModule";
        static title="Plain Text Viewer";
        static description="View text, source, CSS, JavaScript, XML and JSON";
        static icon="📄";
        static showInMenu=false;
        async init(){this.available=true;}
        render(){return null;}
    }
    Framework.register(PlainTextViewerModule.id,PlainTextViewerModule);
    Framework.registerDescriptor(PlainTextViewerModule.id,{components:[
        {id:"FileViewerHash",type:"module",path:"FileViewerHash.js"},
        {id:"PlainTextViewer",type:"module",path:"PlainTextViewer/PlainTextViewer.js"},
        {id:"PlainTextViewer_Provider",type:"provider",path:"PlainTextViewer/PlainTextViewer_Provider.js"}
    ]});
})(Framework);
