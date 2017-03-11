<?php get_header(); ?>

<section id="sliders">
	<div class="orbit" role="region" aria-label="Favorite Space Pictures" data-orbit data-options="animInFromLeft:fade-in; animInFromRight:fade-in; animOutToLeft:fade-out; animOutToRight:fade-out;">
		 <ul class="orbit-container">
<?php
$args = array(
		'post_type' => 'sliders',
		'posts_per_page' => 5
	);

	$the_query = new WP_Query( $args );

	if ( $the_query->have_posts() ) :
		while ( $the_query->have_posts() ) : $the_query->the_post();
			$slide = get_field('slide');
			$link = get_field('link');
			if( !empty($slide) ):

?>
    	<li class="is-active orbit-slide">
				<?php if (empty($link)){ ?>
          <img class="orbit-image grey-off" src="<?php echo $slide['url']; ?>">
				<?php } else { ?>
					<a href="http://<?php echo $link; ?>">
						<img class="orbit-image grey-off" src="<?php echo $slide['url']; ?>">
					</a>
				<?php } ?>
			</li>
		<?php
				endif;
			endwhile;
		endif;
		wp_reset_postdata();

?>
		</ul>
  </div>
</section>

<section id="about-us">
	<div class="content">
		<?php
		$args = array(
			'page_id' => '4'
	);

			$the_query = new WP_Query( $args );
			if ( $the_query->have_posts() ) :
					while ( $the_query->have_posts() ) : $the_query->the_post();
		?>
				<h3><?php echo get_the_title(); ?></h3>
				<div class="testo">
					<?php the_content(); ?>
				</div>
		<?php

			endwhile;
		endif;
		// Reset Post Data
		wp_reset_postdata();

		?>
	</div>
</section>





<section id="eventi" class="hideme">
  <div class="content"><h3>eventi</h3></div>
		<div class="content">
	<?php
	$args = array(
			'post_type' => 'eventi',
			'category_name' => 'top',
			'posts_per_page' => 2
		);

		$the_query = new WP_Query( $args );

		if ( $the_query->have_posts() ) :
			while ( $the_query->have_posts() ) : $the_query->the_post();

			$evento = get_the_title();
			$link = get_the_permalink();
			$cliente= get_field('cliente');
			$cover = get_field('cover');

	?>
		<a href="<?php echo $link;?>">
		<div class="single-event6">
			<!--img  class="thumbnail"src="<?php echo $cover['url'];?>" -->
			<?php
				if ( has_post_thumbnail() ) {
						the_post_thumbnail(900, 600, array( 'center', 'center'));
					}
			?>
			<div class="caption">
				<h3><?php echo $evento; ?></h3>
				<h4><?php echo $cliente; ?></h4>
			</div>
		</div>
	</a>

<?php

	endwhile;
endif;
// Reset Post Data
wp_reset_postdata();
?>
</div>
<div class="content">
<?php

$args = array(
		'post_type' => 'eventi',
		'category__not_in' => 5,
		'posts_per_page' => 3
	);

	$the_query = new WP_Query( $args );

	if ( $the_query->have_posts() ) :
		while ( $the_query->have_posts() ) : $the_query->the_post();

		$evento = get_the_title();
		$link = get_the_permalink();
		$cliente= get_field('cliente');
		$cover = get_field('cover');

?>

		<a href="<?php echo $link;?>">
			<div class="single-event">
				<?php
					if ( has_post_thumbnail() ) {
							the_post_thumbnail(500, 400, array( 'center', 'center'));
						}
				?>
						<div class="caption">
							<h3><?php echo $evento; ?></h3>
							<h4><?php echo $cliente; ?></h4>
						</div>
				</div>
		</a>
	<?php

		endwhile;
	endif;
	// Reset Post Data
	wp_reset_postdata();
	?>
	</div>
</section>

<section id="chi-siamo" class="hideme">
	<div class="content">
		<h3>chi siamo</h3>

		<?php
						$args = array(
								'post_type' => 'dipendenti',
								'posts_per_page' => 3,
								'category_name' => 'capo'
							);

						$the_query = new WP_Query( $args );

						if ( $the_query->have_posts() ) :
							while ( $the_query->have_posts() ) : $the_query->the_post();
								$image = get_field('foto');
								$email = get_field('email');
								$mansione = get_field('mansione');

								if( !empty($image) ):
						?>

						<div class="persona">
							<div class="image-wrapper">
							  <!--span class="image-overlay">
							    <!--span class="contentold hide-for-small-only"><?php echo $mansione; ?></span>
									<a href="mailto:<?php echo $email; ?>">
										<i class="fa fa-envelope-o fa-3x" aria-hidden="true"></i>
									</a>
							  </span-->
									<img src="<?php echo $image['url']; ?>">
							<!--h3 class="mansione show-for-small-only"><?php echo $mansione; ?></h3-->
							<h4><?php echo get_the_title(); ?></h4>
						</div>
					</div>
						<?php
					         endif;
					        endwhile;
					      endif;
					      wp_reset_postdata();

					?>
   </div>
 </div>
</section>

<section id="dove-siamo" class="hideme">
	<div class="content">
		<h3>dove siamo</h3>
	</div>
	<div id="map"></div>
</section>

<?php get_footer();
