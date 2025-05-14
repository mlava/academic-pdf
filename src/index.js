import iziToast from "izitoast";
import { processPDF } from 'pdf-worker-package';

export default {
    onload: ({ extensionAPI }) => {
        const config = {
            tabTitle: "Academic PDF Import",
            settings: [
                {
                    id: "doi-format",
                    name: "Output format",
                    description: "Retrieve the item\'s name and use for the link",
                    action: {
                        type: "select",
                        items: ["Unaltered", "Normalised", "Item Name",]
                    }
                },
            ]
        };
        extensionAPI.settings.panel.create(config);

        extensionAPI.ui.commandPalette.addCommand({
            label: "Paste DOI from clipboard",
            callback: () => pasteDOI()
        });
        extensionAPI.ui.commandPalette.addCommand({
            label: "Check page for DOIs",
            callback: () => checkDOI()
        });

        var divParent = document.createElement('div'); // dropzone
        divParent.classList.add('acPdf_dropzone');
        divParent.innerHTML = "";
        divParent.id = 'acPdf_dropzone';

        if (document.getElementById("acPdf_dropzone")) {
            document.getElementById("acPdf_dropzone").remove();
        }
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
                        let text = await extractPDFTextFromFile(file);
                        let dois = extractUniqueDOIs(text);

                        var doiUrl, articleData;
                        if (dois.length == 0) { // no dois found
                            prompt("There were no DOIs found in that PDF.", 3000, 1);
                        } else if (dois.length == 1) { // hopefully this is the article doi
                            doiUrl = "https://api.crossref.org/works/" + dois[0];
                        } else { // more than one match, so will need to present import options
                            doiUrl = "https://api.crossref.org/works/?filter=";
                            for (var i = 0; i < dois.length; i++) {
                                doiUrl += "doi:" + dois[i] + ",";
                            }
                        }

                        await fetch(doiUrl)
                            .then(response => {
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
                                            await prompt("You cancelled your import", 3000, 1, null);
                                            return;
                                        }
                                    } else { // this is the right metadata
                                        console.info(data.message.title[0]);
                                        articleData = data.message;
                                    }
                                } else {
                                    throw new Error("Invalid response from CrossRef");
                                }
                                console.info(articleData);
                            })
                            .catch(err => {
                                console.error(err);
                                prompt("Failed to retrieve item metadata from CrossRef.", 3000, 1);
                            });
                        /*
                        let url = await window.roamAlphaAPI.file.upload({ file: file });
                            console.info(url);
                        */
                    } else {
                        prompt("This extension only allows PDF file upload.", 3000, 1);
                    }
                });
            } else {
                [...event.dataTransfer.files].forEach(async (file, i) => {
                    if (file.kind === "file" && file.type === "application/pdf") {
                        const file = file.getAsFile();
                        // console.log(`… file[${i}].name = ${file.name}`);
                        await extractPDFTextFromFile(file);

                        let url = await window.roamAlphaAPI.file.upload({ file: file });
                        console.info(url);
                    }
                });
            }
            divParent.classList.remove('hoverOver');
        });
        divParent.addEventListener('dragleave', () => {
            divParent.classList.remove('hoverOver');
        });
    },
    onunload: () => {
        if (document.getElementById("acPdf_dropzone")) {
            document.getElementById("acPdf_dropzone").remove();
        }
    }
}

async function prompt(string, duration, type, selectString) {
    if (type == 1) {
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
    } else if (type == 2) {
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
                title: "Academic PDF Handling",
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

function extractUniqueDOIs(text) {
    const doiRegex = /\b(https?:\/\/doi\.org\/|http:\/\/dx\.doi\.org\/|doi\.org\/)?(10\.[0-9]{4,9}\/[\-._;<>\/\w%]+(?:\([\w\s]+\))?)\b/gi;
    const dois = [];
    let match;

    while ((match = doiRegex.exec(text)) !== null) {
        dois.push(match[2]);
    }

    const uniqueDOIs = [...new Set(dois)];
    return uniqueDOIs;
}