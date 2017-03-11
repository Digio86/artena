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
		<?php wp_head(); ?>
	</head>
	<body >
		<link href="http://cdnjs.cloudflare.com/ajax/libs/foundicons/3.0.0/foundation-icons.css" rel="stylesheet">

<?php if ( get_theme_mod( 'wpt_mobile_menu_layout' ) === 'offcanvas' ) : ?>

		<div class="off-canvas-wrapper">
		  <div class="off-canvas-wrapper-inner" data-off-canvas-wrapper>

				<?php get_template_part( 'template-parts/mobile-off-canvas' ); ?>
				<?php endif; ?>



		    <!-- off-canvas title bar for 'small' screen -->
		    <!--div class="title-bar" data-responsive-toggle="widemenu" data-hide-for="medium">
		      <div class="title-bar-left">
		        <button class="menu-icon" type="button" data-open="offCanvasLeft"></button>
		        <span class="title-bar-title">Foundation</span>
		      </div>
		    </div-->
				<div class="title-bar" data-responsive-toggle="site-navigation">
					<button class="menu-icon" type="button" data-toggle="mobile-menu"></button>
					<div class="title-bar-title">
						<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a>
					</div>

				</div>

		    <!-- off-canvas left menu -->
		    <!--div class="off-canvas position-left" id="offCanvasLeft" data-off-canvas>
		      <ul class="vertical dropdown menu" data-dropdown-menu>
		        <li><a href="left_item_1">Left item 1</a></li>
		        <li><a href="left_item_2">Left item 2</a></li>
		        <li><a href="left_item_3">Left item 3</a></li>
		      </ul>
		    </div-->


		    <!-- "wider" top-bar menu for 'medium' and up -->
				<div data-sticky-container class="show-for-medium-up">
		    <div id="widemenu" class="top-bar sticky" data-sticky data-margin-top="0">
					<div class="top-bar-left">

							<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a>

					</div>
					<!--div class="top-bar-left">
					    <ul class="dropdown menu" data-dropdown-menu>
					      <li class="menu-text">Site Title</li>
					    </ul>
					  </div-->
						<div class="top-bar-right">
							<?php foundationpress_top_bar_r(); ?>

							<?php if ( ! get_theme_mod( 'wpt_mobile_menu_layout' ) || get_theme_mod( 'wpt_mobile_menu_layout' ) === 'topbar' ) : ?>
								<?php get_template_part( 'template-parts/mobile-off-canvas' ); ?>
							<?php endif; ?>
					    <!--ul class="menu" data-responsive-menu="drilldown medium-dropdown">
								<li><a href="#">One</a></li>
					      <li><a href="#">Two</a></li>
					      <li><a href="#">Three</a></li>
					    </ul-->
					  </div>
		  	</div>
				</div>

			</div>
		</div>



		<!--div class="title-bar" data-responsive-toggle="main-menu" data-hide-for="medium">
  		<button class="menu-icon" type="button" data-toggle></button>
  		<div class="title-bar-title">Menu</div>
		</div>

		<div class="top-bar" id="main-menu">
		  <div class="top-bar-left">
		    <ul class="dropdown menu" data-dropdown-menu>
		      <li class="menu-text">Site Title</li>
		    </ul>
		  </div>
		  <div class="top-bar-right">
		    <ul class="menu" data-responsive-menu="drilldown medium-dropdown">
					<li><a href="#">One</a></li>
		      <li><a href="#">Two</a></li>
		      <li><a href="#">Three</a></li>
		    </ul>
		  </div>
		</div-->







	<div id="backtotop" class="hide-for-small-only">
		<a class="button round secondary">
			<i class="fa fa-arrow-up"></i>
		</a>
	</div>

	<section class="container">
		<?php do_action( 'foundationpress_after_header' );
