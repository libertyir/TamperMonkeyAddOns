(function (Framework) {
    "use strict";
    class ImageFileViewerModule extends Framework.BaseModule {
        static id="ImageFileViewerModule";
        static title="Image File Viewer";
        static description="Preview images and inspect file hashes";
        static icon="🖼️";
        async init(){this.available=true;}
        render(){return null;}
    }
    Framework.register(ImageFileViewerModule.id,ImageFileViewerModule);
    Framework.registerDescriptor(ImageFileViewerModule.id,{components:[
        {id:"FileViewerHash",type:"module",path:"FileViewerHash.js"},
        {id:"ImageFileViewer",type:"module",path:"ImageFileViewer/ImageFileViewer.js"},
        {id:"ImageFileViewer_Provider",type:"provider",path:"ImageFileViewer/ImageFileViewer_Provider.js"}
    ]});
})(Framework);
