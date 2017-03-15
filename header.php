<?php
/**
 * The template for displaying the header
 *
 * Displays all of the head element and everything up until the "container" div.
 *
 * @package FoundationPress
 * @since FoundationPress 1.0.0
 */

?>
<!doctype html>
<html class="no-js" <?php language_attributes(); ?> >
	<head>
		<meta charset="<?php bloginfo( 'charset' ); ?>" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />

		<!-- Begin Cookie Consent plugin by Silktide - http://silktide.com/cookieconsent -->
		<script type="text/javascript">
		    window.cookieconsent_options = {"message":"Questo sito utilizza cookie, anche di terze parti, per inviarti servizi in linea con le tue preferenze. Se vuoi saperne di più o negare il consenso a tutti o ad alcuni cookie leggi l'informativa estesa sui cookie.","dismiss":"HO CAPITO","learnMore":"Maggiori informazioni","link":"http://www.argentaia.com/test/cookie-policy/","theme":"dark-top"};
		</script>

		<script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/cookieconsent2/1.0.10/cookieconsent.min.js"></script>
		<!-- End Cookie Consent plugin -->



		<!-- link rel="icon" href="<?php echo get_stylesheet_directory_uri() ; ?>/assets/images/icons/favicon.ico" type="image/x-icon">
		<link rel="apple-touch-icon-precomposed" sizes="144x144" href="<?php echo get_stylesheet_directory_uri() ; ?>/assets/images/icons/apple-touch-icon-144x144-precomposed.png">
		<link rel="apple-touch-icon-precomposed" sizes="114x114" href="<?php echo get_stylesheet_directory_uri() ; ?>/assets/images/icons/apple-touch-icon-114x114-precomposed.png">
		<link rel="apple-touch-icon-precomposed" sizes="72x72" href="<?php echo get_stylesheet_directory_uri() ; ?>/assets/images/icons/apple-touch-icon-72x72-precomposed.png">
		<link rel="apple-touch-icon-precomposed" href="<?php echo get_stylesheet_directory_uri() ; ?>/assets/images/icons/apple-touch-icon-precomposed.png" -->


		<?php wp_head(); ?>
	</head>
<<<<<<< HEAD
	<body >
		<link href="http://cdnjs.cloudflare.com/ajax/libs/foundicons/3.0.0/foundation-icons.css" rel="stylesheet">
=======
	<body <?php body_class(); ?>>
	<?php do_action( 'foundationpress_after_body' ); ?>

	<?php if ( get_theme_mod( 'wpt_mobile_menu_layout' ) === 'offcanvas' ) : ?>
	<div class="off-canvas-wrapper">
		<div class="off-canvas-wrapper-inner" data-off-canvas-wrapper>
		<?php get_template_part( 'template-parts/mobile-off-canvas' ); ?>
	<?php endif; ?>

	<?php do_action( 'foundationpress_layout_start' ); ?>

	<header id="masthead" class="site-header" role="banner">
		<div class="title-bar" data-responsive-toggle="mobile-menu">
			<button class="menu-icon" type="button" data-toggle="mobile-menu"></button>
			<div class="title-bar-title">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a>
			</div>
		</div>
>>>>>>> c067a86f5e526ab35eb48a25577ddc07f372e181

<?php if ( get_theme_mod( 'wpt_mobile_menu_layout' ) === 'offcanvas' ) : ?>

		<div class="off-canvas-wrapper">
		  <div class="off-canvas-wrapper-inner" data-off-canvas-wrapper>

				<?php get_template_part( 'template-parts/mobile-off-canvas' ); ?>
				<?php endif; ?>




				<div class="title-bar"  data-responsive-toggle="site-navigation">
					<button class="menu-icon" type="button" data-toggle="mobile-menu"></button>
					<div class="title-bar-title">
						<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
							<img class="logo" src="<?php echo get_bloginfo('template_url'); ?>/assets/images/artena-logo.png">
						</a>
					</div>
				</div>


		    <!-- "wider" top-bar menu for 'medium' and up -->
				<div data-sticky-container class="show-for-medium-up">
		    <div id="widemenu" class="top-bar sticky" data-sticky data-margin-top="0">
					<div class="top-bar-left">

							<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home">
								<img class="logo" src="<?php echo get_bloginfo('template_url'); ?>/assets/images/artena-logo.png">
							</a>

					</div>

						<div class="top-bar-right">
							<?php foundationpress_top_bar_r(); ?>

							<?php if ( ! get_theme_mod( 'wpt_mobile_menu_layout' ) || get_theme_mod( 'wpt_mobile_menu_layout' ) === 'topbar' ) : ?>
								<?php get_template_part( 'template-parts/mobile-off-canvas' ); ?>
							<?php endif; ?>

					  </div>
		  	</div>
				</div>


			</div>

		</div>

	<div id="backtotop" class="hide-for-small-only">
		<a class="button round secondary">
			<!--i class="fa fa-arrow-up"></i-->
			<i class="fi-arrow-up"></i>
		</a>
	</div>

	<section class="container">
		<?php do_action( 'foundationpress_after_header' );
