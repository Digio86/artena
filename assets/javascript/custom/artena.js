$(function() {
    $(window).scroll( function(){


        $('.hideme').each( function(i){

            var bottom_of_object = $(this).position().top + $(this).outerHeight();
            var bottom_of_window = $(window).scrollTop() + $(window).height();

            /* Adjust the "200" to either have a delay or that the content starts fading a bit before you reach it  */
            bottom_of_window = bottom_of_window + 500;

            if( bottom_of_window > bottom_of_object ){

                $(this).animate({'opacity':'1'},500);

            }
        });

    });
});

$(window).scroll(function() {

  /* animazione top menu */
  if($(this).scrollTop()>50){
      $("#backtotop").css("opacity"," 1");
  } else {
    $("#backtotop").css("opacity", "0");
  }

  });

 /*Azione GoTop*/
 function goto_top() {
   $('html, body').animate({
     scrollTop: 0
   },1500);
 }

 /* BACK TO TOP */
 $("#backtotop a").click( function() {
   goto_top();
 });

/*Roll-hover immagini winner*/

$(document).ready(function() {
  $('.single-event').hover(
    function(){

      $(this).find('.caption').fadeIn(350);
    },
    function(){
      $(this).find('.caption').fadeOut(200);
    }
  );
});

$(document).ready(function() {
  $('.single-event6').hover(
    function(){

      $(this).find('.caption').fadeIn(350);
    },
    function(){
      $(this).find('.caption').fadeOut(200);
    }
  );
});


/*Classe menu */
$(window).scroll(function() {
  if($(this).scrollTop()>100){
  $(".is-stuck").addClass("smaller");
  $(".is-stuck").removeClass("bigger");


} else {
$(".is-stuck").removeClass("smaller");
$(".top-bar").addClass("bigger");

 }
  });


/*Grey imagine*/
$(window).scroll(function() {
  if($(this).scrollTop()>500){
  $(".orbit-image").addClass("grey-on");

} else {
$("img.orbit-image").removeClass("grey-on");

 }
  });
