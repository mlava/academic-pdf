import iziToast from "izitoast";
import { processPDF } from 'pdf-worker-package';
let hashChange = undefined;

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "Academic PDF Import",
            settings: [
                {
                    id: "journalOrder",
                    name: "Journal reference",
                    description: "Which position to place the journal reference data",
                    action: {
                        type: "select",
                        items: ["1", "2", "3", "4", "5", "Hide"],
                        onChange: (evt) => { setJournalOrder(evt); }
                    }
                },
                {
                    id: "doiOrder",
                    name: "DOI",
                    description: "Which position to place the DOI",
                    action: {
                        type: "select",
                        items: ["1", "2", "3", "4", "5", "Hide"],
                        onChange: (evt) => { setDOIOrder(evt); }
                    }
                },
                {
                    id: "authorsOrder",
                    name: "Authors",
                    description: "Which position to place the Authors",
                    action: {
                        type: "select",
                        items: ["1", "2", "3", "4", "5", "Hide"],
                        onChange: (evt) => { setAuthOrder(evt); }
                    }
                },
                {
                    id: "referencesOrder",
                    name: "References",
                    description: "Which position to place the article's references",
                    action: {
                        type: "select",
                        items: ["1", "2", "3", "4", "5", "Hide"],
                        onChange: (evt) => { setRefsOrder(evt); }
                    }
                },
                {
                    id: "abstractOrder",
                    name: "Abstract",
                    description: "Which position to place the abstract",
                    action: {
                        type: "select",
                        items: ["1", "2", "3", "4", "5", "Hide"],
                        onChange: (evt) => { setAbstractOrder(evt); }
                    }
                },
            ]
        };

        extensionAPI.settings.panel.create(config);

        extensionAPI.ui.commandPalette.addCommand({
            label: "Paste PDF from clipboard",
            callback: () => retrieveAcPDF(true, null)
        });

        // onload
        var journalOrder, authorsOrder, referencesOrder, doiOrder, abstractOrder;
        if (extensionAPI.settings.get("journalOrder") != null) {
            if (extensionAPI.settings.get("journalOrder") == "Hide") {
                journalOrder = "Hide";
            } else {
                journalOrder = parseInt(extensionAPI.settings.get("journalOrder"));
            }
        } else {
            journalOrder = 1;
        }
        if (extensionAPI.settings.get("doiOrder") != null) {
            if (extensionAPI.settings.get("doiOrder") == "Hide") {
                doiOrder = "Hide";
            } else {
                doiOrder = parseInt(extensionAPI.settings.get("doiOrder"));
            }
        } else {
            doiOrder = 2;
        }
        if (extensionAPI.settings.get("authorsOrder") != null) {
            if (extensionAPI.settings.get("authorsOrder") == "Hide") {
                authorsOrder = "Hide";
            } else {
                authorsOrder = parseInt(extensionAPI.settings.get("authorsOrder"));
            }
        } else {
            authorsOrder = 3;
        }
        if (extensionAPI.settings.get("referencesOrder") != null) {
            if (extensionAPI.settings.get("referencesOrder") == "Hide") {
                referencesOrder = "Hide";
            } else {
                referencesOrder = parseInt(extensionAPI.settings.get("referencesOrder"));
            }
        } else {
            referencesOrder = 4;
        }
        if (extensionAPI.settings.get("abstractOrder") != null) {
            if (extensionAPI.settings.get("abstractOrder") == "Hide") {
                abstractOrder = "Hide";
            } else {
                abstractOrder = parseInt(extensionAPI.settings.get("abstractOrder"));
            }
        } else {
            abstractOrder = 5;
        }

        // onchange
        async function setJournalOrder(evt) {
            if (evt == "Hide") {
                journalOrder = "Hide";
            } else {
                journalOrder = parseInt(evt);
            }
        }
        async function setDOIOrder(evt) {
            if (evt == "Hide") {
                doiOrder = "Hide";
            } else {
                doiOrder = parseInt(evt);
            }
        }
        async function setAuthOrder(evt) {
            if (evt == "Hide") {
                authorsOrder = "Hide";
            } else {
                authorsOrder = parseInt(evt);
            }
        }
        async function setRefsOrder(evt) {
            if (evt == "Hide") {
                referencesOrder = "Hide";
            } else {
                referencesOrder = parseInt(evt);
            }
        }
        async function setAbstractOrder(evt) {
            if (evt == "Hide") {
                abstractOrder = "Hide";
            } else {
                abstractOrder = parseInt(evt);
            }
        }

        hashChange = async (e) => {
            sleep(50);
            addDropzone();
        };
        window.addEventListener('hashchange', hashChange);

        addDropzone(); // onload
        async function addDropzone() {
            var divParent = document.createElement('div'); // dropzone
            divParent.classList.add('acPdf_dropzone');
            divParent.innerHTML = "";
            divParent.id = 'acPdf_dropzone';

            if (document.getElementById("acPdf_dropzone")) {
                document.getElementById("acPdf_dropzone").remove();
            }
            if (document.getElementsByClassName("rm-article-wrapper") && document.getElementsByClassName("rm-article-wrapper").length > 0) {
                let wrapper = document.getElementsByClassName("rm-article-wrapper")[0];
                wrapper.after(divParent);
                divParent.addEventListener("dragover", (event) => {
                    event.preventDefault();
                    divParent.classList.add('hoverOver');
                });
                divParent.addEventListener("drop", (event) => {
                    divParent.classList.add('hoverOver');
                    event.preventDefault();
                    if (event.dataTransfer.items) {
                        [...event.dataTransfer.items].forEach(async (item, i) => {
                            if (item.kind === "file" && item.type === "application/pdf") {
                                const file = item.getAsFile();
                                return await retrieveAcPDF(false, file);
                            } else {
                                prompt("This extension only allows PDF file upload.", 3000, 1);
                                return;
                            }
                        });
                    } else {
                        [...event.dataTransfer.files].forEach(async (file, i) => {
                            if (file.kind === "file" && file.type === "application/pdf") {
                                const file = file.getAsFile();
                                return await retrieveAcPDF(false, file);
                            } else {
                                prompt("This extension only allows PDF file upload.", 3000, 1);
                                return;
                            }
                        });
                    }
                    divParent.classList.remove('hoverOver');
                });
                divParent.addEventListener('dragleave', () => {
                    divParent.classList.remove('hoverOver');
                });
            }
        }

        async function retrieveAcPDF(pasted, file) {
            if (pasted) { // pasted file, retrieve from clipboard
                /*
                const clipboardItems = await navigator.clipboard.read();
                console.info(clipboardItems);
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        const blob = await clipboardItem.getType(type);
                        // we can now use blob here
                    }
                }
                */
            }

            let text = await extractPDFTextFromFile(file);
            let dois = await extractUniqueDOIs(text);

            var doiUrl, articleData;
            if (dois.length == 0) { // no dois found
                let manualDOI = await prompt("There were no DOIs found in that PDF. Would you like to add one manually?", null, 3, null);
                if (manualDOI != undefined && manualDOI != "cancelled") {
                    doiUrl = "https://api.crossref.org/works/" + manualDOI;
                } else {
                    await prompt("Import Cancelled", 3000, 1, null);
                    return;
                }
            } else if (dois.length == 1) { // hopefully this is the article doi
                doiUrl = "https://api.crossref.org/works/" + dois[0];
            } else { // more than one match, so will need to present the user some imported options
                doiUrl = "https://api.crossref.org/works/?filter=";
                for (var i = 0; i < dois.length; i++) {
                    doiUrl += "doi:" + dois[i] + ",";
                }
            }

            await fetch(doiUrl)
                .then(async response => {
                    if (response.status === 404) {
                        throw new Error("DOI not found (404)");
                    }
                    return response.json();
                })
                .then(async data => {
                    if (data.status === "ok") {
                        if (data.message.hasOwnProperty("items")) { // we must have searched on multiple DOIs
                            var promptString = "Which of these articles is correct?";
                            let selectString = "<select><option value=\"\">Select</option>";
                            for (var i = 0; i < data.message.items.length; i++) {
                                selectString += "<option value=\"" + i + "\">" + data.message.items[i].title[0] + "</option>";
                            }
                            selectString += "</select>";

                            var searchQuery = await prompt(promptString, null, 2, selectString);
                            if (searchQuery != undefined && searchQuery != "cancelled") {
                                articleData = data.message.items[searchQuery];
                            } else {
                                await prompt("Import Cancelled", 3000, 1, null);
                                return;
                            }
                        } else { // this is the right metadata
                            articleData = data.message;
                        }

                        var blocks = [];
                        var children = [];
                        if (journalOrder != "Hide") {
                            var journalName, journalVol, journalIssue, pages, year;
                            if (articleData["container-title"] != null && articleData.hasOwnProperty("container-title")) {
                                journalName = articleData["container-title"][0];
                                journalVol = articleData.volume;
                                journalIssue = articleData.issue;
                                pages = articleData.page;
                                year = articleData.published["date-parts"][0][0];

                                var journalString = "[[" + journalName + "]]";
                                if (year != undefined) {
                                    journalString += " " + year + "";
                                }
                                if (journalVol != undefined) {
                                    journalString += "; " + journalVol + "";
                                }
                                if (journalIssue != undefined) {
                                    journalString += "(" + journalIssue + ")";
                                }
                                if (pages != undefined) {
                                    journalString += ":" + pages + "";
                                }
                                children[journalOrder - 1] = { "text": journalString, };
                            }
                        }

                        if (doiOrder != "Hide") {
                            children[doiOrder - 1] = { "text": "**DOI:** [" + articleData.DOI + "](https://doi.org/" + articleData.DOI + ")", };
                        }

                        if (authorsOrder != "Hide") {
                            var authors = articleData.author;
                            var authorsBlock = [];
                            for (var i = 0; i < authors.length; i++) {
                                var authorString = "";
                                var authorName = authors[i].given + " " + authors[i].family;
                                var matchingAuthorPages = await window.roamAlphaAPI.q(`
                                    [:find ?e
                                        :where [?e :node/title "${authorName}"]]`);
                                if (matchingAuthorPages != null && matchingAuthorPages.length > 0) {
                                    // there's a matching author page
                                    authorString = "[[" + authors[i].given + " " + authors[i].family + "]]";
                                } else {
                                    authorString = "" + authors[i].given + " " + authors[i].family + "";
                                }
                                authorsBlock.push({ "text": authorString, });
                            }
                            children[authorsOrder - 1] = { "text": "**Authors:** (" + authors.length + ")", "children": authorsBlock };
                        }

                        if (referencesOrder != "Hide") {
                            var referenceCount = articleData["reference-count"];
                            var references = articleData.reference;
                            var referencesBlock = [];
                            for (var i = 0; i < references.length; i++) {
                                var refTitle;
                                if (references[i].hasOwnProperty("article-title")) {
                                    refTitle = references[i]["article-title"];

                                    var matchingArticlePages = await window.roamAlphaAPI.q(`
                                    [:find ?e
                                        :where [?e :node/title "${refTitle}"]]`);
                                    if (matchingArticlePages != null && matchingArticlePages.length > 0) {
                                        // there's a matching article page
                                        refTitle = "[[" + refTitle + "]]";
                                    } else {
                                        if (references[i].hasOwnProperty("DOI")) {
                                            refTitle = "[" + refTitle + "](https://doi.org/" + references[i]["DOI"] + ")";
                                        }
                                    }
                                } else {
                                    refTitle = "[" + references[i]["DOI"] + "](https://doi.org/" + references[i]["DOI"] + ")";
                                }
                                referencesBlock.push({ "text": refTitle });
                            }
                            children[referencesOrder - 1] = { "text": "**References:** (" + referenceCount + ")", "children": referencesBlock };
                        }

                        if (abstractOrder != "Hide") {
                            if (articleData.hasOwnProperty("abstract") && articleData.abstract != null) {
                                var abstract = articleData.abstract;
                                if (abstract != undefined) {
                                    children[abstractOrder - 1] = { "text": "**Abstract:**", "children": [{ "text": abstract, }], };
                                }
                            }
                        }

                        blocks.push({ "text": articleData.title[0], "children": children });

                        var page, matchingPages;
                        var newPageUid = roamAlphaAPI.util.generateUID();
                        page = await window.roamAlphaAPI.q(`
                                                [:find ?e
                                                :where [?e :node/title "${articleData.title[0]}"]]`);
                        if (page.length < 1) { // create new page
                            await window.roamAlphaAPI.createPage({ page: { title: blocks[0].text.toString(), uid: newPageUid } });
                            var parentUid = roamAlphaAPI.util.generateUID();
                            await window.roamAlphaAPI.createBlock({ location: { "parent-uid": newPageUid, order: 0 }, block: { string: "**" + blocks[0].text + "**".toString(), uid: parentUid } });
                            blocks = blocks[0].children;
                            await createBlocks(blocks, parentUid);
                        } else { // there's already a page with that name
                            matchingPages = await window.roamAlphaAPI.data.pull("[:block/string :block/uid {:block/children ...}]", [":node/title", newPageName]);
                            newPageUid = matchingPages[":block/uid"];
                            newPageName1 = newPageName1.split("@")[0];
                            if (matchingPages.hasOwnProperty(":block/children")) { // already some children here
                                for (var i = 0; i < matchingPages[":block/children"].length; i++) {
                                    if (matchingPages[":block/children"][i][":block/string"] == newPageName1) {
                                        titleUid = matchingPages[":block/children"][i][":block/uid"].toString();
                                    }
                                };
                                for (var i = 0; i < matchingPages[":block/children"][0][":block/children"].length; i++) {
                                    let blockString = matchingPages[":block/children"][0][":block/children"][i][":block/string"].toString();
                                    if (blockString.startsWith("**Corpus ID:**")) {
                                        corpId = matchingPages[":block/children"][0][":block/children"][i][":block/string"].toString();
                                        corpId = corpId.split("**Corpus ID:**");
                                        corpId = corpId[1].trim();
                                    }
                                };
                            } else { // no article data on matching page title
                                await window.roamAlphaAPI.updateBlock(
                                    { block: { uid: parentUid, string: "[[" + newPageName + "]]".toString(), open: true } });
                                parentUid = roamAlphaAPI.util.generateUID();
                                await window.roamAlphaAPI.createBlock({ location: { "parent-uid": newPageUid, order: 0 }, block: { string: "**" + firstBlock + "**".toString(), uid: parentUid } });
                                blocks = blocks[0].children;
                                await createBlocks(blocks, parentUid);
                            }

                            if (corpId != undefined) {
                                if (corpId != newCorpId) { // same page name but different corpus ID = new article
                                    newPageName = newPageName + " ~ " + newCorpId;
                                    newPageUid = roamAlphaAPI.util.generateUID();
                                    await window.roamAlphaAPI.createPage({ page: { title: newPageName, uid: newPageUid } });
                                    await window.roamAlphaAPI.updateBlock(
                                        { block: { uid: parentUid, string: "[[" + newPageName + "]]".toString(), open: true } });
                                    parentUid = roamAlphaAPI.util.generateUID();
                                    await window.roamAlphaAPI.createBlock({ location: { "parent-uid": newPageUid, order: 0 }, block: { string: "**" + firstBlock + "**".toString(), uid: parentUid } });
                                    blocks = blocks[0].children;
                                    await createBlocks(blocks, parentUid);
                                } else { // same name, same corpus ID = same article
                                    var string = "This article is already in your graph. Would you like to update the data?"
                                    overwrite = await prompt(string, null, 1, null);

                                    if (overwrite) { // overwrite existing data on the article page
                                        await window.roamAlphaAPI.updateBlock(
                                            { block: { uid: parentUid, string: "[[" + newPageName + "]]".toString(), open: true } });
                                        if (titleUid != undefined) {
                                            parentUid = titleUid;
                                        }
                                        // delete current children and replace with new data
                                        blocks = blocks[0].children;
                                        var headerString = "**Recommendations:**";
                                        var longHeaderString = "**Recommendations:** {{Import Recommendations:SmartBlock";
                                        for (var i = 0; i < matchingPages[":block/children"].length; i++) {
                                            if (matchingPages[":block/children"][i][":block/uid"] == parentUid) {
                                                for (var j = 0; j < matchingPages[":block/children"][i][":block/children"].length; j++) {
                                                    if (matchingPages[":block/children"][i][":block/children"][j][":block/string"].startsWith(headerString)) {
                                                        if (matchingPages[":block/children"][i][":block/children"][j][":block/string"].startsWith(longHeaderString)) {
                                                            window.roamAlphaAPI.deleteBlock({ block: { uid: matchingPages[":block/children"][i][":block/children"][j][":block/uid"] } });
                                                        } else { // we want to keep this block and not put a new Recommendations block and SB button in place
                                                            for (var k = 0; k < blocks.length; k++) {
                                                                var blockString = blocks[k].text.toString();
                                                                if (blockString.startsWith(longHeaderString)) {
                                                                    blocks.splice(k, 1);
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        window.roamAlphaAPI.deleteBlock({ block: { uid: matchingPages[":block/children"][i][":block/children"][j][":block/uid"] } });
                                                    }
                                                }
                                            }
                                        }
                                        await createBlocks(blocks, parentUid);
                                        overwrite = false;
                                    }
                                }
                            }
                        }

                        let url = await window.roamAlphaAPI.file.upload({ file: file });
                        var newBlock = roamAlphaAPI.util.generateUID();
                        await window.roamAlphaAPI.createBlock({ location: { "parent-uid": newPageUid, order: 99 }, block: { string: url, uid: newBlock } });
                        await window.roamAlphaAPI.ui.rightSidebar
                            .addWindow({
                                window:
                                    { type: 'outline', 'block-uid': newPageUid }
                            });
                        await window.roamAlphaAPI.ui.rightSidebar
                            .collapseWindow({
                                window:
                                    { type: 'outline', 'block-uid': newPageUid }
                            });
                    } else {
                        throw new Error("Invalid response from CrossRef");
                    }
                })
                .catch(async err => {
                    console.error(err);
                    let errorCheck = await prompt("There was an error determining article metadata from CrossRef. Would you like to import the PDF anyway?", null, 4, null);
                    if (errorCheck) {

                    } else {
                        await prompt("Import Cancelled", 3000, 1, null);
                        return;
                    }
                });
        };
    },
    onunload: () => {
        if (document.getElementById("acPdf_dropzone")) {
            document.getElementById("acPdf_dropzone").remove();
        }
        window.removeEventListener('hashchange', hashChange);
    }
}

// helper functions
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function prompt(string, duration, type, selectString) {
    if (type == 1) { // announcements
        iziToast.show({
            theme: 'dark',
            message: string,
            class: 'acPdf-info',
            position: 'center',
            close: false,
            timeout: duration,
            closeOnClick: true,
            closeOnEscape: true,
            displayMode: 2
        });
    } else if (type == 2) { // select the correct article from list
        return new Promise((resolve) => {
            iziToast.question({
                theme: 'light',
                color: 'black',
                layout: 2,
                drag: false,
                class: 'acPdf',
                timeout: false,
                close: true,
                overlay: true,
                title: "Academic PDF Import",
                message: string,
                position: 'center',
                onClosed: function () { resolve("cancelled") },
                closeOnEscape: true,
                inputs: [
                    [selectString, 'change', function (instance, toast, select, e) { }]
                ],
                buttons: [
                    ['<button><b>Confirm</b></button>', function (instance, toast, button, e, inputs) {
                        instance.hide({ transitionOut: 'fadeOut' }, toast, 'button');
                        resolve(inputs[0].selectedIndex - 1);
                    }, false], // true to focus
                    [
                        "<button>Cancel</button>",
                        function (instance, toast, button, e) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve("cancelled");
                        },
                    ],
                ]
            });
        })
    } else if (type == 3) { // see if user wants to add manual DOI
        return new Promise((resolve) => {
            iziToast.question({
                theme: 'light',
                color: 'black',
                layout: 2,
                class: 'acPdf',
                drag: false,
                timeout: false,
                close: false,
                overlay: true,
                displayMode: 2,
                id: "question",
                title: "Academic PDF Import",
                message: string,
                position: "center",
                onClosed: function () { resolve("cancelled") },
                inputs: [
                    [
                        '<input type="text" placeholder="">',
                        "keyup",
                        function (instance, toast, input, e) {
                            if (e.code === "Enter") {
                                instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                                resolve(e.srcElement.value);
                            }
                        },
                        true,
                    ],
                ],
                buttons: [
                    [
                        "<button><b>Confirm</b></button>",
                        async function (instance, toast, button, e, inputs) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve(inputs[0].value);
                        },
                        false,
                    ],
                    [
                        "<button>Cancel</button>",
                        async function (instance, toast, button, e) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve("cancelled");
                        },
                    ],
                ],
            });
        })
    } else if (type == 4) { // metadata import from CrossRef failed, see if user wants to import PDF anyway
        return new Promise((resolve) => {
            iziToast.question({
                theme: 'light',
                color: 'black',
                layout: 2,
                class: 'acPdf',
                drag: false,
                timeout: false,
                close: false,
                overlay: true,
                displayMode: 2,
                id: "question",
                title: "Academic PDF Import",
                message: string,
                position: "center",
                onClosed: function () { resolve(false) },
                buttons: [
                    [
                        "<button><b>Yes</b></button>",
                        async function (instance, toast, button, e, inputs) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve(true);
                        },
                        false,
                    ],
                    [
                        "<button>No</button>",
                        async function (instance, toast, button, e) {
                            instance.hide({ transitionOut: "fadeOut" }, toast, "button");
                            resolve(false);
                        },
                    ],
                ],
            });
        })
    }
}

async function extractPDFTextFromFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const text = await processPDF(arrayBuffer);
        return (text);
    } catch (error) {
        console.error('Error processing PDF:', error);
    }
}

async function extractUniqueDOIs(text) {
    const doiRegex = /\b(https?:\/\/doi\.org\/|http:\/\/dx\.doi\.org\/|doi\.org\/)?(10\.[0-9]{4,9}\/[\-._;<>\/\w%]+(?:\([\w\s]+\))?)\b/gi;
    const dois = [];
    let match;

    while ((match = doiRegex.exec(text)) !== null) {
        dois.push(match[2]);
    }

    const uniqueDOIs = [...new Set(dois)];
    return uniqueDOIs;
}

async function createBlocks(blocks, parentUid) {
    await sleep(50); // brief pause
    blocks.forEach((node, order) => {
        createBlock({
            parentUid,
            order,
            node
        })
    });
}

// copied and adapted from https://github.com/dvargas92495/roamjs-components/blob/main/src/writes/createBlock.ts
const createBlock = (params) => {
    const uid = window.roamAlphaAPI.util.generateUID();
    return Promise.all([
        window.roamAlphaAPI.createBlock({
            location: {
                "parent-uid": params.parentUid,
                order: params.order,
            },
            block: {
                uid,
                string: params.node.text
            }
        })
    ].concat((params.node.children || []).map((node, order) =>
        createBlock({ parentUid: uid, order, node })
    )))
};