const canvas = document.getElementById("canvas");
const generateBtn = document.getElementById("generate");
const downloadBtn = document.getElementById("download");

const type = document.getElementById("type");
const content = document.getElementById("content");

const qrColor = document.getElementById("qrColor");
const bgColor = document.getElementById("bgColor");

let qr = new QRCodeStyling({
    width: 300,
    height: 300,
    type: "canvas",
    data: "https://example.com",

    dotsOptions: {
        color: "#000000",
        type: "rounded"
    },

    backgroundOptions: {
        color: "#ffffff"
    },

    cornersSquareOptions: {
        type: "extra-rounded"
    },

    cornersDotOptions: {
        type: "dot"
    }
});

qr.append(canvas);

generateBtn.onclick = () => {

    let data = content.value.trim();

    if (!data) {
        alert("Введите данные.");
        return;
    }

    switch(type.value){

        case "phone":
            data = "tel:" + data;
            break;

        case "email":
            data = "mailto:" + data;
            break;

        case "url":
            if(!data.startsWith("http://") && !data.startsWith("https://")){
                data = "https://" + data;
            }
            break;

        case "wifi":
            data = "WIFI:T:WPA;S:" + data + ";P:password;;";
            break;

    }

    qr.update({

        data: data,

        dotsOptions:{
            color: qrColor.value,
            type:"rounded"
        },

        backgroundOptions:{
            color:bgColor.value
        }

    });

};

downloadBtn.onclick = () => {

    qr.download({
        name:"Nobu-QR",
        extension:"png"
    });

};
