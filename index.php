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
			$frase = get_field('frase');
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
				<div class="orbit-caption">
					<h1><?php echo $frase; ?></h1>
</div>
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

		<a class="button large" href="about-us">altro ...</a>
	</div>
</section>





<section id="eventi" class="hideme">
  <div class="content"><h3>eventi</h3></div>
		<div class="content" style="position:relative;">
	<?php
	$args = array(
			'post_type' => 'eventi',
			'cat' => 5,
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

		<div class="single-event6">
				<a href="<?php echo $link; ?>">
					<figure>
						<?php
							if ( has_post_thumbnail() ) {
									the_post_thumbnail(900, 600, array( 'center', 'center'));
								}
						?>
						<div class="caption">
							<h3><?php echo $evento; ?></h3>
							<h4><?php echo $cliente; ?></h4>
						</div>
					</figure>
				</a>
			</div>
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
		'cat' => 6,
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
			<div class="single-event">
				<a href="<?php echo $link; ?>">
					<figure>
						<?php
							if ( has_post_thumbnail() ) {
									the_post_thumbnail(900, 600, array( 'center', 'center'));
								}
						?>
						<div class="caption">
							<h3><?php echo $evento; ?></h3>
							<h4><?php echo $cliente; ?></h4>
						</div>
					</figure>
				</a>
			</div>
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
									<img src="<?php echo $image['url']; ?>" class="filtro-grigio">
									<div class="cornerLink show-for-large">
										<a href="mailto:<?php echo $email; ?>" class="sendmail">
											<i class="fi-mail"></i>
										</a>
									</div>


						</div>
						<h4><?php echo get_the_title(); ?></h4>
						<div class="address show-for-small hide-for-large">
							<a href="mailto:<?php echo $email; ?>">
								E-mail
							</a>
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

<section id="dove-siamo" class="hideme nopadding">
	<div class="content">
		<h3>dove siamo</h3>
	</div>
	<div id="map"></div>
</section>

<?php get_footer();
