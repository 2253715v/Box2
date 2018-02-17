var express = require("express");
const path = require('path')
var bodyParser = require('body-parser');
var mysql = require('mysql');
var cookieParser = require('cookie-parser');
var io = require('socket.io')();
io.listen(6969);


var app = express();

app.use('/static', express.static(path.join(__dirname, 'static')))
app.set('views', __dirname + '/views')
app.set('view engine', 'pug')
app.use(cookieParser());


var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "stockexchange",
    multipleStatements: true,
});

con.connect(function (err) {
    if (err) throw err;
});


app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

var port = process.env.PORT || 8000;

var authenticationMiddleware = function (req, res, next) {
    req.authenticated = false;
    if (req.body.email !== undefined && req.body.password !== undefined) {
        con.query("SELECT * FROM Users WHERE email = '" + req.body.email + "' and password = '" + req.body.password + "'", function (err, result, fields) {
            if (err) throw err;
            if (result.length === 1) {
                res.cookie("email", req.body.email);
                res.cookie("password", req.body.password);
                req.name = result[0].name;
                req.email = req.body.email;
                req.authenticated = true;
            }
            next()
        });
    } else if (req.cookies.email !== undefined && req.cookies.password !== undefined) {
        con.query("SELECT * FROM Users WHERE email = '" + req.cookies.email + "' and password = '" + req.cookies.password + "'", function (err, result, fields) {
            if (err) throw err;
            if (result.length === 1) {
                req.authenticated = true;
                req.email = req.cookies.email;
                req.name = result[0].name;
            }
            next()
        });
    } else {
        next()
    }
}

app.use(authenticationMiddleware);


app.listen(port, function () {
    console.log("Server running on " + port);
});

app.get("/", function (req, res) {

    if(req.authenticated){
        con.query("SELECT * FROM Account INNER JOIN Holdings ON Account.user_id=Holdings.user_id WHERE Account.user_id='"+req.email+"' ;", function(err, result, fields){
            if (err) throw err;
            balance = 0;
            num_shares = 0;
            
            if (result.length === 1) {
                num_shares = result[0].num_shares;
                balance = result[0].balance;
            }

            res.render('exchange/index', {"name":req.name, "authenticated":req.authenticated, "balance":balance, "num_shares":num_shares})
        });

    }else{
        res.render('exchange/index', {"name":req.name, "authenticated":req.authenticated})
    }
});

app.get("/auth/login/", function(req, res){
    errors = []
    if(req.authenticated){
        res.redirect("/")
        return
    }
    res.render('registration/user_login');
});

app.post("/auth/login/", function(req, res){
    if(req.authenticated){
        res.redirect("/")
        return
    }
    errors = []

    email = req.body.email
    password = req.body.password

    if(email == undefined){

        errors.push("Please enter a valid email!")
        res.render('registration/user_login')
        return
    }
    
    if(password == undefined){
        errors.push("Please enter a valid password!")
        res.render('registration/user_login')
        return
    }

    con.query("SELECT * FROM Users WHERE email = '" + email + "' and password = '" + password + "'", function (err, result, fields) {
        if (err) throw err;
        console.log(result);
        if (result.length === 1) {
            res.cookie("email", req.body.email);
            res.cookie("password", req.body.password);
            res.redirect("/");
        } else {
            errors.push("Could not find an account with that email or password!")
            res.render('registration/user_login')
        }
    });

});

app.get("/auth/register/", function(req, res){
    errors = []
    if(req.authenticated){
        res.redirect("/")
        return
    }
    res.render('registration/user_register');
});

app.post("/auth/register/", function(req, res){
    errors = []
    
    full_name = req.body.name
    email = req.body.email
    password = req.body.password
    password_confirm = req.body.password_confirm

    if(full_name !== undefined && full_name !== ""){
        if(email !== undefined && email !== ""){
            if(password !== undefined && password !==""){
                if(password_confirm !== undefined){
                    if(password == password_confirm){
                        prepared_statement = `REPLACE INTO Users (name, email, password) VALUES ("${full_name}","${email}", "${password}");`
                        con.query(prepared_statement);

                        prepared_statement = `REPLACE INTO Account (user_id, balance) VALUES ("${email}", 100000);`
                        con.query(prepared_statement);

                        prepared_statement = `REPLACE INTO Holdings (user_id, symbol, num_shares) VALUES ("${email}", "NAT", 0);`
                        con.query(prepared_statement);
                    } else {
                        errors.push("Password and password confirmation do not match!");
                    }
                } else {
                    errors.push("Please provide a password confirmation!");
                }
            } else {
                errors.push("Please enter a password!");
            }
        } else {
            errors.push("Please provide an email address!");
        }
    } else {
        errors.push("Please provide your full name");
    }

    if(errors.length==0){
        res.redirect('/auth/login/');
    }else{
        res.render('registration/user_register');
    }
});

app.get("/auth/logout/", function(req, res){
    res.clearCookie("email");
    res.clearCookie("password");
    res.redirect('/');
});

app.get("/maintenance", function(req, res) {
   if (req.authenticated) {
       process.exit();
   }
});

app.get("/stockprices/", function(req, res){
    timedelta = req.query.timedelta || 24
    then = new Date()
    then.setHours(new Date().getHours()-timedelta)
    then = then.toISOString().slice(0, 19).replace('T', ' ')

    con.query("SELECT unix_timestamp(datetime) * 1000 as datetime, traded_at FROM StockHistory WHERE (symbol='NAT') AND (datetime >= '"+then+"');", function(err, result, fields){
        data = {}
        data["labels"] = []
        data["data"] = []

        for(entry in result){
            data["labels"].push(result[entry]["datetime"])
            data["data"].push(result[entry]["traded_at"])
        }

        res.send(data)
    });
});

//Make a trade
app.get("/trade", function(req, res){
    errors = []
    
    if(req.cookies.email !== undefined && req.query.trade !== undefined && req.query.amount !== undefined && req.query.amount%1==0 && req.query.amount >= 1){
        email = req.cookies.email
        trade_type = req.query.trade
        amount = parseInt(req.query.amount)

        con.query("SELECT * FROM Account INNER JOIN Holdings ON Account.user_id=Holdings.user_id WHERE Account.user_id='"+email+"' ;", function(err, result, fields){
            if (err){
                errors.push("Authentication error!")
                res.send({errors:errors})
                return
            }

            if (result.length === 1) {
                num_shares = result[0].num_shares;
                balance = result[0].balance;

                con.query("SELECT * FROM Stocks WHERE symbol='NAT';", function(err, result, fields){
                    if(err){
                        errors.push("Encountered an error")
                        res.send({errors:errors})
                        return
                    }

                    if(result.length ===1){
                        price = result[0].last_price

                        if(trade_type=="B"){
                            new_balance = balance - amount*price
                            new_shares = num_shares + amount

                            if(new_balance < 0){
                                errors.push("Too few funds!")
                                res.send({errors:errors})
                                return
                            }
                        }else if(trade_type=="S"){
                            new_balance = balance + amount*price
                            new_shares = num_shares - amount

                            if(new_shares < 0){
                                errors.push("Trying to sell too much stock!")
                                res.send({errors:errors})
                                return
                            }
                        }else{
                            errors.push("Invalid Transaction")
                            res.send({errors:errors})
                            return
                        }

                        con.query("UPDATE Account SET balance='"+new_balance+"' WHERE user_id='"+email+"';");
                        con.query("UPDATE Holdings SET num_shares='"+new_shares+"' WHERE user_id='"+email+"';");
                        con.query(`INSERT INTO Trades (user_id, symbol, transaction, num_shares, price) VALUES ("${email}","NAT","${trade_type}","${amount}","${price}");`);

                        res.send({balance:new_balance, shares:new_shares});
                    }
                });
            }
        });
    } else {
        errors.push("Invalid Amount!")
        res.send({errors:errors})
    }
});
