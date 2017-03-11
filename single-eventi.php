<?php get_header(); ?>

<div id="single-post" role="main">
<?php
		$args = array(
			'p'         => $post->ID,
			'post_type' => 'any'

			);

			$the_query = new WP_Query( $args );

			$evento = get_the_title();
      $cliente= get_field('cliente');
      /*$cover = get_field('cover');*/
			$contenuto = get_field('descrizione');
			$gallery = get_field('gallery');

  		while ( $the_query->have_posts() ) : $the_query->the_post();

	 ?>
		<div class="colonna-1">
		<h3><?php echo $evento; ?></h3>
			<?php
				if ( has_post_thumbnail() ) {
						the_post_thumbnail(600, 400, array( 'center', 'center'));
					}
			?>
		</div>
		<div class="colonna-2">
			<?php echo $contenuto; ?>
			<h4>Cliente:<span ><?php echo $cliente; ?></span></h4>
		</div>
		<div class="gallery-eventi">
			<h3>Gallery:</h3>
			<?php the_content(); ?>

	 </div>
<?php
endwhile;
// Reset Post Data
wp_reset_postdata();

	?>


<?php do_action( 'foundationpress_after_content' ); ?>

</div>
<?php get_footer();
