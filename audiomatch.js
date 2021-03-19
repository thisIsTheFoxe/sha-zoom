const fullAudioFiles = ['1000-Things.mp3', '2020-Rendezvous.mp3', 'Miss-Canadia.mp3', 'Second-Sight.mp3', '2020-Rendezvous-Remix.mp3', 'clip1.wav', 'clip2.wav', 'clip3.wav', 'clip4.wav', 'clip5.wav', 'clip1.1.wav', 'clip2.1.wav', 'clip3.1.wav', 'clip4.1.wav', 'clip5.1.wav'];
var audioCtx;
var selectedAudioFile = '';
var audioBuffer = null;
var audio;
var analyser;
var aTimeout;
var noisePrintRaw = [];
var quantise = 256;
var notZero = false;
var noisePrints;
var limitPoints = 6;
var spectrumlinecount = 0;
var fftSize = 2048;

$(function () {

    try {
        noisePrints = JSON.parse(localStorage.getItem("noiseprints")) || {};

    } catch (error) {
        noisePrints = {};
    }


    setupFiles();

    setupNoisePrints();

    $('.maxpoints').val(limitPoints);
    $('.maxpoints').blur(function () {

        limitPoints = parseInt($(this).val());
        console.log("max points per slice set to " + limitPoints);

    })

    calcFreq();

});


function setupFiles() {

    for (var i = 0; i < fullAudioFiles.length; i++) {
        $('.fullaudiofiles').append('<div class="fullaudiofile" data-filename="' + fullAudioFiles[i] + '">' + fullAudioFiles[i] + '</div>');

        if (fullAudioFiles[i].includes("clip")) {
            $('.fullaudiofile').last().attr("style", "background-color:#023");
        }
    }

    $('.fullaudiofile').click(function () {

        analyseAudio($(this).data("filename"));


    });

}

function setupNoisePrints() {

    $(".noiseprints").html('');

    Object.keys(noisePrints).forEach(function (k) {
        $('.noiseprints').append("<div class='noiseprint' data-name='" + k + "'>" + k + "</div>");
    });

    $('.noiseprint').click(function () {

        matchClip($(this).data("name"));

    });

}

var firstrun = true;

function analyseAudio(fn) {
    firstrun = true;

    notZero = false;
    clearTimeout(aTimeout);

    if (audio) {
        audio.pause();
    }

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    audio = new Audio("audio/" + fn + '?id=4');
    selectedAudioFile = fn;

    const source = audioCtx.createMediaElementSource(audio);
    source.connect(audioCtx.destination);
    spectrumlinecount = 0;
    audio.play();
    analyser = audioCtx.createAnalyser();
    analyser.minDecibels = -100;
    analyser.smoothingTimeConstant = 0.5;
    analyser.fftSize = fftSize;
    source.connect(analyser);

    audio.onended = function () {
        console.log("saving noiseprint");
        saveNoisePrint();
    };

    $('.spectrum').html('');

    aTimeout = setTimeout("addToSpectrum();", 200);

    noisePrintRaw = [];
}

function addToSpectrum() {


    aTimeout = setTimeout("addToSpectrum();", 100);

    spectrumlinecount++;

    if (spectrumlinecount > 300) {
        spectrumlinecount = 0;
        $('.spectrum').html('');
    }

    var dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    dataArray = squareArray(dataArray);
    dataArray = normalizeArray(dataArray, quantise);

    var sl = $("<div class='spectrumline'></div>");


    var reducedArray = [];

    var freqStep = parseInt($(".freqstep").val());
    var startat = parseInt($(".startat").val());
    var endat = parseInt($(".endat").val());
    var pointGroups = parseInt($(".pointgroups").val());

    for (var i = startat; i < endat * freqStep; i += freqStep) {



        var value = 0.0;

        for (var ii = i; ii < Math.min(analyser.frequencyBinCount, i + freqStep); ii++) {

            value = Math.max(value, dataArray[ii]);

        }


        value = Math.round(value);


        if (value > 0) {
            notZero = true;
        }


        //console.log((24000 / analyser.frequencyBinCount) * i);
        reducedArray.push(value);

    }

    var pointCount = 0;

    var fftArray = [...reducedArray];

    for (var i = 0; i < reducedArray.length; i += Math.round((endat - startat) / pointGroups)) {

        var mx = 0.0;

        for (var ii = 0; ii < Math.round((endat - startat) / pointGroups); ii++) {

            mx = Math.max(mx, reducedArray[i + ii]);

        }

        for (var ii = 0; ii < Math.round((endat - startat) / pointGroups); ii++) {


            if (reducedArray[i + ii] != mx || pointCount === limitPoints) { // || reducedArray[i + ii] < (quantise / 2) -gate
                reducedArray[i + ii] = 0;
            } else {
                reducedArray[i + ii] = quantise;
                pointCount++;
            }

        }

    }


    for (var i = 0; i < fftArray.length; i++) {

        var f = $("<div />");

        if (reducedArray[i] === 0) {
            f.css("backgroundColor", "rgb(" + (fftArray[i] * (256 / quantise)) / 2 + ",0," + (255 - (fftArray[i] * (256 / quantise))) / 2 + ")");

        } else {
            f.css("backgroundColor", "rgb(" + reducedArray[i] * (256 / quantise) + "," + ((reducedArray[i] * (256 / quantise)) - 128) * 2 + ",0)");

        }
        sl.append(f);

    }

    if (firstrun) {

        firstrun = false;

    }

    if (notZero) {

        $(".spectrum").append(sl).scrollLeft(1000000);

        noisePrintRaw.push(reducedArray);

    }


}

function normalizeArray(array, value) {
    var ratio = Math.max.apply(Math, array) / value;
    var numbers = [...array];
    for (var i = 0; i < array.length; i++) {
        numbers[i] = (numbers[i] / ratio);
    }
    return numbers;
}


function squareArray(array) {
    var numbers = [...array];
    for (var i = 0; i < array.length; i++) {
        numbers[i] = numbers[i] * numbers[i];
    }
    return numbers;
}

function saveNoisePrint() {

    audio.pause();

    clearTimeout(aTimeout);
    noisePrints[selectedAudioFile] = noisePrintRaw;
    setupNoisePrints();
    localStorage.setItem("noiseprints", JSON.stringify(noisePrints));

}

function matchClipOld(name) {

    console.clear();


    var range = 50;

    Object.keys(noisePrints).forEach(function (k) {
        if (k !== name) {

            var minError = 1.0;

            for (var i = 0; i < noisePrints[k].length - range; i++) {
                var npChunk = [];


                for (var x = 0; x < range; x++) {
                    npChunk = npChunk.concat(noisePrints[k][i + x]);
                }

                for (var ii = 0; ii < noisePrints[name].length - range; ii++) {
                    var npcChunk = [];
                    for (var x = 0; x < range; x++) {
                        npcChunk = npcChunk.concat(noisePrints[name][ii + x]);
                    }

                    var error = 0.0;

                    for (var y = 0; y < npcChunk.length; y++) {

                        error += ((Math.abs(npcChunk[y] - npChunk[y]) / quantise));

                    }

                    minError = Math.min(minError, (error / npcChunk.length));

                }


            }

            console.log(k + " " + minError);

        }
    });

}


function matchClip(name) {

    console.clear();

    $(".output").html("");

    var scores = {};

    scores.min = 99999999;
    scores.max = 0;



    Object.keys(noisePrints).forEach(function (k) { // go round each song in the 'database'


        if (!k.includes("clip")) {

            var matchScore = 0;
            var lookForward = 1;

            for (var i = 0; i < noisePrints[name].length - lookForward; i++) { // go round each slice of the noiseprint you want to match

                var anchor = -2;

                while (anchor !== -1) {

                    if (anchor === -2) anchor = -1;

                    anchor = noisePrints[name][i].indexOf(quantise, anchor + 1);

                    if (anchor !== -1) {

                        var points = [];
                        var ii = 0;
                        var offset = anchor;

                        while (points.length < 4 && ii < 2) {

                            var newPoint = noisePrints[name][i + ii].indexOf(quantise, offset + 1);

                            if (newPoint !== -1) {
                                points.push(newPoint);
                                offset = newPoint;
                            } else {
                                ii++;
                                offset = -1;
                            }

                        }


                        if (points.length === 4) {


                            for (var ki = 1; ki < noisePrints[k].length - lookForward; ki++) {

                                if (noisePrints[k][ki][anchor] === quantise) {

                                    var localMatchScore = 0;

                                    for (var px = 0; px < 4; px++) {

                                        for (var sx = 0; sx < lookForward + 1; sx++) {
                                            if (noisePrints[k][ki + sx][points[px]] === quantise) {
                                                localMatchScore++;
                                            }
                                        }

                                    }

                                    if (localMatchScore > 3) {
                                        matchScore++;
                                    }

                                }

                            }

                        }


                    }

                }


            }

            matchScore = (matchScore / noisePrints[k].length)

            console.log("score: " + k + " " + matchScore);

            scores.min = Math.min(scores.min, matchScore);
            scores.max = Math.max(scores.max, matchScore);
            scores[k] = {};
            scores[k].score = matchScore;



        }
    });

    Object.keys(noisePrints).forEach(function (k) {

        if (!k.includes("clip")) {
            var chosen = '';
            if (scores[k].score === scores.max) chosen = 'chosen';

            $('.output').append("<div class='" + chosen + "'><span>" + k + "</span>" + (scores[k].score / scores.max).toFixed(2) + "</div>")


        }


    });

}

function calcFreq() {

    var freqStep = parseInt($(".freqstep").val());
    var startat = parseInt($(".startat").val());;
    var endat = parseInt($(".endat").val());;

    var low = (24000 / (fftSize / 2)) * startat;
    var high = (24000 / (fftSize / 2)) * endat * freqStep;

    $(".calcfreq").html(low.toFixed(0) + "Hz - " + high.toFixed(0) + "Hz");

}