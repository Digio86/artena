<?php
/*
Template Name: Eventi
*/
get_header(); ?>

 <?php get_template_part( 'template-parts/featured-image' ); ?>

<div id="page-eventi" role="main">


  <?php while ( have_posts() ) : the_post(); ?>
    <header>
        <h1 class="entry-title"><?php the_title(); ?></h1>
    </header >
  <?php endwhile;?>

  <div class="content-eventi">


  <?php

  $args = array(
      'post_type' => 'eventi',
      'posts_per_page' => 9
    );

    $the_query = new WP_Query( $args );

    if ( $the_query->have_posts() ) :
      while ( $the_query->have_posts() ) : $the_query->the_post();

      $evento = get_the_title();
      $link = get_the_permalink();
      $cliente= get_field('cliente');
      $cover = get_field('cover');

  ?>

      <div class="evento hideme">
        <figure>
          <a href="<?php echo $link; ?>">
            <?php
              if ( has_post_thumbnail() ) {
                  the_post_thumbnail(400, 300, array( 'center', 'center'));
                }
            ?>
          </a>
        </figure>
        <h3><?php echo $evento; ?></h3>
        <h4><?php echo $cliente; ?></h4>
      </div>

      <?php

				endwhile;
			endif;
			// Reset Post Data
			wp_reset_postdata();

			?>

  </div>

  </div>


<?php get_footer();
