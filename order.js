"use strict";
/*
    License: OPL-1
    author: farooq@aarsol.com   
*/
odoo.define('aar_pos_ticket_receipt.order', function (require) {

    var utils = require('web.utils');
    var round_pr = utils.round_precision;
    var models = require('point_of_sale.models');
    var core = require('web.core');
    var qweb = core.qweb;
    var sumptotmrp=0;
    var _t = core._t;
    var _super_Order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            _super_Order.initialize.apply(this, arguments);
        },      
        
        init_from_JSON: function (json) {
            var res = _super_Order.init_from_JSON.apply(this, arguments);
            if (json.ean13) {
                this.ean13 = json.ean13;
            }
            return res;
        },
        export_as_JSON: function () {
            var json = _super_Order.export_as_JSON.apply(this, arguments);
            
            if (this.ean13) {
                json.ean13 = this.ean13;
            }
            if (!this.ean13 && this.uid) { // init ean13 and automatic create ean13 for order
                var ean13 = '998';

                if (this.pos.user.id) {
                    ean13 += this.pos.user.id;
                }
                if (this.sequence_number) {
                    ean13 += this.sequence_number;
                }
                if (this.pos.config.id) {
                    ean13 += this.pos.config.id;

                }
                var fean13 = this.uid.split('-');
                for (var i in fean13) {
                    ean13 += fean13[i];
                }
                ean13 = ean13.split("");
                var aean13 = []
                var sean13 = ""
                for (var i = 0; i < ean13.length; i++) {
                    if (i < 12) {
                        sean13 += ean13[i]
                        aean13.push(ean13[i])
                    }
                }
                this.ean13 = sean13 + this.generate_ean13(aean13).toString()
            }
            return json;
        },
        generate_ean13: function (code) {
            if (code.length != 12) {
                return -1
            }
            var evensum = 0;
            var oddsum = 0;
            for (var i = 0; i < code.length; i++) {
                if ((i % 2) == 0) {
                    evensum += parseInt(code[i])
                } else {
                    oddsum += parseInt(code[i])
                }
            }
            var total = oddsum * 3 + evensum
            return parseInt((10 - total % 10) % 10)
        },
        
        fix_tax_included_price: function (line) {
            _super_Order.fix_tax_included_price.apply(this, arguments);
            if (this.fiscal_position) {
                var unit_price = line.product['list_price'];
                var taxes = line.get_taxes();
                var mapped_included_taxes = [];
                _(taxes).each(function (tax) {
                    var line_tax = line._map_tax_fiscal_position(tax);
                    if (tax.price_include && tax.id != line_tax.id) {

                        mapped_included_taxes.push(tax);
                    }
                })
                if (mapped_included_taxes.length > 0) {
                    unit_price = line.compute_all(mapped_included_taxes, unit_price, 1, this.pos.currency.rounding, true).total_excluded;
                    line.set_unit_price(unit_price);
                }
            }
        },
        
        
        
        get_total_before_tax: function() {
		    return this.get_total_without_tax() + this.get_order_discount();
		},
		get_order_discount: function() {
			return round_pr(this.orderlines.reduce((function(sum, orderLine) {
				if (orderLine.get_product().display_name == 'Discount Product')
					return sum + Math.abs(orderLine.get_price_without_tax());
				else
				    return sum;
			}), 0), this.pos.currency.rounding);
		},
		get_new_order:function(){
		        console.log(orderlines);

		},
		clear_local_data:function(){				//this function clear the localstorage use for saving data..
                 if(sessionStorage.getItem("producttotal")){
          //var newproduct=JSON.parse(sessionStorage.getItem("producttotal"));
                    //newproduct.push({name:nediscname,
                                       //price:strtotmrpc,});
                    //sessionStorage.setItem("producttotal",JSON.stringify(newproduct));                   
                    sessionStorage.removeItem("producttotal");

          }else{

          }
          //return 0;

        },
        get_total_mrp: function() { //this function get the value of todays savings..
            
            var prototal=JSON.parse(sessionStorage.getItem("producttotal"));
         
            var k=0;
            for(let i=0; i<prototal.length; i++) {
                     let key = prototal[i].price;
                     var count=parseFloat(key);
                     k=k+count;
                     
            }
            
            var discountprice=this.get_total_before_tax();
            var savings=k-discountprice;

            return savings;



    },



       
        
        
    });

    var _super_Orderline = models.Orderline.prototype;
    models.Orderline = models.Orderline.extend({

        
        get_item_discout: function(){
        	var discount = this.get_unit_price() * (this.get_discount() / 100.0);
        	return discount;        	
        },
        get_price_discount: function () { 
            var price_unit = this.get_unit_price();
            var prices = this.get_all_prices();
            var priceWithTax = prices['priceWithTax'];
            var tax = prices['tax'];
            var discount = priceWithTax - tax - price_unit;
            return discount
        },
        get_pricelist_percent:function(){  //here we find the price list where we giving % of discount of product..
          var disctrail=this.pos.pricelists[0].items;
          var disname=this.get_product().display_name;
          var disc=0;
         // console.log(this.price);
          _.each(disctrail,function(keyo){//here we find giving % are given


                _.each(keyo,function(sekeyo,value){

                        if(sekeyo==disname){
                            //console.log(keyo["percent_price"]);
                            disc=keyo["percent_price"];
			 }
                        });
                });
                return disc;

        },

        get_fix_discount:function(){ //this function calculate the original price...beacuse price is alredy shown in discount form...
          var disctrail=this.pos.pricelists[0].items;
          var disname=this.get_product().display_name;

          var disc=0;
         
         /* _.each(disctrail,function(keyo){
                //console.log(keyo);

                _.each(keyo,function(sekeyo,value){
                        //console.log(sekeyo);
                        //console.log(value);
                        if(sekeyo==disname){
                            console.log(keyo["percent_price"]);
                            disc=keyo["percent_price"];


                                //console.log("hello displayname");


                                }
                        });
                });*/
           var disc=this.get_pricelist_percent();

          var totunit=this.get_quantity_str_with_unit();
          var intotunit=parseFloat(totunit);
          var price_withdisc = this.get_unit_price();
          price_withdisc=price_withdisc;
          var sigleprice_withdisc=price_withdisc;
          var takemrp=1;
          var mrp=disc*takemrp;
          var mrpre=(sigleprice_withdisc*100)/(100-disc);
          mrpre=parseInt(mrpre);

          return mrpre;

        },
        get_total_Mrp:function(){
          var disctrail=this.pos.pricelists[0].items;
          var disname=this.get_product().display_name;

          var disc=0;
         
         /* _.each(disctrail,function(keyo){
                //console.log(keyo);

                _.each(keyo,function(sekeyo,value){
                        //console.log(sekeyo);
                        //console.log(value);
                        if(sekeyo==disname){
                            console.log(keyo["percent_price"]);
                            disc=keyo["percent_price"];


                                //console.log("hello displayname");


                                }
                        });
                });*/


          var totomrpprice=0;
          var disc=this.get_pricelist_percent();
          var totunit=this.get_quantity_str_with_unit();
          var intotunit=parseFloat(totunit);
          var price_withdisc = this.get_unit_price();
          //var sigleprice_withdisc=price_withdisc/intotunit;
          var sigleprice_withdisc=price_withdisc;
          var takemrp=1;
          var mrp=disc*takemrp;
          var mrpre=(sigleprice_withdisc*100)/(100-(disc));
          mrpre=mrpre*intotunit;

           //var totmrpc=mrpre*1;
          totmrpc=parseInt(mrpre);

          //totomrpprice=totomrpprice+totmrpc;
          //this.total_Mrp_price(totmrpc);
         
          //get_total_mrp(totmrpc);
          //console.log("hello print selected quantity");
         // var od=new orderlines();         
          var nediscname=disname.toString();        
          var strtotmrpc=totmrpc.toString();
          if(sessionStorage.getItem("producttotal")!=undefined){
          var newproduct=JSON.parse(sessionStorage.getItem("producttotal"));
                    newproduct.push({name:nediscname,
                                       price:strtotmrpc,});
                    sessionStorage.setItem("producttotal",JSON.stringify(newproduct));

          }else{
          var producttotal=[{
               name:nediscname,
               price:strtotmrpc,

          }];
           sessionStorage
           .setItem("producttotal",JSON.stringify(producttotal));
          }
          //var discnamenew=disname+"@++productname"


          return totmrpc;


        },




        
    });
});
