function updateData(timedelta){
    $.get("/stockprices/", {timedelta:timedelta}, function(data){
        if(data){
            labels = data.labels

            for(label in labels){
                labels[label] = new Date(labels[label])
            }

            regenerateChart(labels, data.data)
        }
    });
}

function buyStock(){
    $.get("/trade", {trade: "B", amount:$("#id_buy_amount").val()}, function(data){
        if(data){
            if(data.balance){
                $("#balance_p").text("Account Balance: "+data.balance)
                $("#holdings_p").text("NAT Holdings: "+data.shares)
            }else{
                location.reload();
            }
        }
    });
}

function sellStock(){
    $.get("/trade", {trade: "S", amount:$("#id_sell_amount").val()}, function(data){
        if(data){
            if(data.balance){
                $("#balance_p").text("Account Balance: "+data.balance)
                $("#holdings_p").text("NAT Holdings: "+data.shares)
            }else{
                location.reload(); 
            }
        }
    });
}

Chart.defaults.global.legend.display = false;

function regenerateChart(labels, data){
    $("#stockChart").remove()
    $("#stockChartContainer").append("<canvas id='stockChart'></canvas>")

    var ctx = $("#stockChart")

    var chart = new Chart(ctx, {
        type: 'line',
        animationEnabled: false,
        
        data: {
            labels: labels,
            datasets: [{
                data:data,
                fill:false,
                borderColor:"rgba(54,162,244,0.8)",
                borderWidth:2,
                pointBorderWidth:0,
                backgroundColor: 'rgba(54,162,244,0.8)',
                lineTension: 0,
            }]
        },

        options: {
            scales: {
                xAxes: [{
                    type: 'time',
                    distribution: 'linear',
                    position:'bottom',
                }]
            },
            elements: {
                point: {
                    radius:0,
                    hitRadius: 10,
                    hoverRadius: 5,
                }
            },
            responsive: true,
        }
    });
}

//Refresh the graph every minute
function refresh(){
    updateData(current_scale);
    setTimeout(refresh, 60000);
}

buttons = ["#stock_hour", "#stock_day","#stock_week","#stock_month"]
buttonscales = [1,24,168,5040]

function switchButtons(buttonselector){
    buttons.forEach(function(button) {
        $(button).removeClass("disabled");
    });
    $(buttonselector).addClass("disabled");
}

function memeJSFunction(number){
    return function(){
        current_scale = buttonscales[number];
        switchButtons(buttons[number]);
        updateData(current_scale);
    };
}
var current_scale = 24;
switchButtons("#stock_day");

for (var i=0;i<buttons.length;i++){
    $(buttons[i]).click(memeJSFunction(i));
}

refresh();
